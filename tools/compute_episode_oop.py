"""
compute_episode_oop.py

Multi-phase episode out-of-pocket calculation engine.
Tracks deductible and OOP max across all phases (pre-op, surgery, post-op)
with proper handling of Rx copays, coinsurance, and OOP cap.
"""

from tools.episode_costs import EPISODE_COSTS, uses_operating_room_style_charges


def compute_episode_oop(
    episode: dict,
    negotiated_rate: float,
    plan: dict,
    deductible_remaining: float,
    oop_max_remaining: float,
    include_complication_risk: bool = False,
    hospital_complication_rate: float | None = None,
) -> dict:
    coinsurance_pct = plan.get("coinsurance_pct", 0.20)
    rx_tiers = {
        1: plan.get("rx_tier1", 10),
        2: plan.get("rx_tier2", 35),
        3: plan.get("rx_tier3", 70),
    }

    def estimate_total_oop(negotiated: float) -> float:
        # User-requested formula:
        # if deductible remaining > negotiated -> negotiated
        # else deductible remaining + coinsurance% of remaining
        # and always cap at oop max remaining
        if deductible_remaining >= negotiated:
            pre_cap = negotiated
        else:
            pre_cap = deductible_remaining + (coinsurance_pct * max(0.0, negotiated - deductible_remaining))
        return round(min(pre_cap, oop_max_remaining), 2)

    def allocate_oop_by_gross(items: list[dict], total_oop: float) -> tuple[list[dict], float]:
        if not items:
            return items, 0.0
        gross_total = sum(float(i.get("gross_cost", 0) or 0) for i in items)
        if gross_total <= 0:
            per = round(total_oop / len(items), 2)
            running = 0.0
            for idx, item in enumerate(items):
                if idx == len(items) - 1:
                    item["your_cost"] = round(max(0.0, total_oop - running), 2)
                else:
                    item["your_cost"] = per
                    running += per
            return items, round(sum(i["your_cost"] for i in items), 2)

        running = 0.0
        for idx, item in enumerate(items):
            share = float(item.get("gross_cost", 0) or 0) / gross_total
            val = round(total_oop * share, 2)
            if idx == len(items) - 1:
                val = round(max(0.0, total_oop - running), 2)
            else:
                running += val
            item["your_cost"] = val
        return items, round(sum(i["your_cost"] for i in items), 2)

    def process_item(item: dict) -> dict:
        name = item["name"]
        is_rx = item.get("cpt") == "rx" or "rx_tier" in item

        if is_rx:
            fills = item.get("fills", 1)
            gross_cost = item["cost"]
            cpt_code = "Rx"
            qty = fills
        elif "sessions" in item:
            sessions = item["sessions"]
            cost_per = item.get("cost_per_session", item["cost"] / sessions if sessions else item["cost"])
            gross_cost = cost_per * sessions
            cpt_code = item.get("cpt", item.get("hcpcs", ""))
            qty = sessions
        else:
            visits = item.get("visits", 1)
            gross_cost = item["cost"] * visits
            cpt_code = item.get("cpt", item.get("hcpcs", ""))
            qty = visits

        return {
            "name": name,
            "cpt": cpt_code,
            "qty": qty,
            "gross_cost": round(gross_cost, 2),
            "your_cost": 0.0,
        }

    preop_items = [process_item(item) for item in episode.get("preop", [])]
    preop_oop = sum(i["your_cost"] for i in preop_items)

    implant_cost = episode.get("implant_cost", 0)
    or_style = uses_operating_room_style_charges(episode)

    surgery_items: list[dict] = []

    if or_style:
        facility_pct = 0.55
        surgeon_pct = 0.30
        anesthesia_pct_of_surgeon = 0.18

        facility_cost = negotiated_rate * facility_pct
        surgeon_cost = negotiated_rate * surgeon_pct
        anesthesia_cost = surgeon_cost * anesthesia_pct_of_surgeon

        surgery_items.append({"name": "Facility Fee", "cpt": episode["cpt_primary"], "qty": 1,
                              "gross_cost": round(facility_cost, 2), "your_cost": 0.0})

        surgery_items.append({"name": "Surgeon Fee", "cpt": episode["cpt_primary"], "qty": 1,
                              "gross_cost": round(surgeon_cost, 2), "your_cost": 0.0})

        anes_cpt = "01402"
        surgery_items.append({"name": "Anesthesia", "cpt": anes_cpt, "qty": 1,
                              "gross_cost": round(anesthesia_cost, 2), "your_cost": 0.0})
    else:
        # Outpatient / imaging / non-surgical: no OR or separate anesthesia line
        facility_cost = negotiated_rate * 0.65
        professional_cost = negotiated_rate * 0.35
        surgery_items.append({
            "name": "Facility & technical",
            "cpt": episode["cpt_primary"],
            "qty": 1,
            "gross_cost": round(facility_cost, 2),
            "your_cost": 0.0,
        })
        surgery_items.append({
            "name": "Professional (physician)",
            "cpt": episode["cpt_primary"],
            "qty": 1,
            "gross_cost": round(professional_cost, 2),
            "your_cost": 0.0,
        })

    if implant_cost > 0:
        surgery_items.append({"name": "Implant", "cpt": "implant", "qty": 1,
                              "gross_cost": round(implant_cost, 2), "your_cost": 0.0})

    postop_items = [process_item(item) for item in episode.get("postop", [])]

    complication_scenario_oop = None
    if include_complication_risk and hospital_complication_rate is not None:
        comp_gross = episode.get("complication_cost_avg", 0)
        if comp_gross > 0:
            postop_items.append({
                "name": "Expected complication cost",
                "cpt": "complication",
                "qty": 1,
                "gross_cost": round(comp_gross, 2),
                "your_cost": 0.0,
            })
            complication_scenario_oop = 0.0

    total_episode_oop = estimate_total_oop(float(negotiated_rate))
    preop_gross = sum(i["gross_cost"] for i in preop_items)
    surgery_gross = sum(i["gross_cost"] for i in surgery_items)
    postop_gross = sum(i["gross_cost"] for i in postop_items)
    episode_gross = preop_gross + surgery_gross + postop_gross

    if episode_gross <= 0:
        preop_target = 0.0
        surgery_target = total_episode_oop
        postop_target = 0.0
    else:
        preop_target = round(total_episode_oop * (preop_gross / episode_gross), 2)
        surgery_target = round(total_episode_oop * (surgery_gross / episode_gross), 2)
        postop_target = round(max(0.0, total_episode_oop - preop_target - surgery_target), 2)

    preop_items, preop_oop = allocate_oop_by_gross(preop_items, preop_target)
    surgery_items, surgery_oop = allocate_oop_by_gross(surgery_items, surgery_target)
    postop_items, postop_oop = allocate_oop_by_gross(postop_items, postop_target)
    total_episode_oop = round(preop_oop + surgery_oop + postop_oop, 2)

    return {
        "preop_oop": round(preop_oop, 2),
        "surgery_oop": round(surgery_oop, 2),
        "postop_oop": round(postop_oop, 2),
        "total_episode_oop": total_episode_oop,
        "oop_max_hit": total_episode_oop >= oop_max_remaining,
        "preop_items": preop_items,
        "surgery_items": surgery_items,
        "postop_items": postop_items,
        "complication_scenario_oop": complication_scenario_oop,
    }


if __name__ == "__main__":
    episode = EPISODE_COSTS["knee_replacement"]
    plan = {"coinsurance_pct": 0.20, "rx_tier1": 10, "rx_tier2": 35, "rx_tier3": 70}

    result = compute_episode_oop(
        episode=episode,
        negotiated_rate=18400,
        plan=plan,
        deductible_remaining=1400,
        oop_max_remaining=4600,
    )

    print("=== Knee Replacement Episode OOP Smoke Test ===")
    print(f"\nPre-op OOP: ${result['preop_oop']:,.2f}")
    for item in result["preop_items"]:
        print(f"  {item['name']:30s}  Gross: ${item['gross_cost']:>8,.2f}  Your Cost: ${item['your_cost']:>8,.2f}")

    print(f"\nSurgery OOP: ${result['surgery_oop']:,.2f}")
    for item in result["surgery_items"]:
        print(f"  {item['name']:30s}  Gross: ${item['gross_cost']:>8,.2f}  Your Cost: ${item['your_cost']:>8,.2f}")

    print(f"\nPost-op OOP: ${result['postop_oop']:,.2f}")
    for item in result["postop_items"]:
        print(f"  {item['name']:30s}  Gross: ${item['gross_cost']:>8,.2f}  Your Cost: ${item['your_cost']:>8,.2f}")

    print(f"\n{'='*60}")
    print(f"Total Episode OOP: ${result['total_episode_oop']:,.2f}")
    print(f"OOP Max Hit: {result['oop_max_hit']}")
    print(f"Complication Scenario OOP: {result['complication_scenario_oop']}")
