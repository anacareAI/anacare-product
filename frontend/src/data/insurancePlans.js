// Mirrors carecost-navigator-v2 (single `const PLANS` in that HTML). Plan counts per carrier:
// uhc 7 · bcbs 8 · ambetter 7 · aetna 7 · cigna 8 · humana 7 · kaiser 6 · anthem 8 · molina 6  (64 total)
// Per-plan "deductible already met" is not in source data; it defaults to 0 in the UI.

export const INSURANCE_CARRIERS = [
  { id: 'uhc', name: 'UnitedHealthcare', color: '#002855' },
  { id: 'bcbs', name: 'Blue Cross Blue Shield', color: '#0066B3' },
  { id: 'ambetter', name: 'Ambetter', color: '#00B4D8' },
  { id: 'aetna', name: 'Aetna', color: '#6D2077' },
  { id: 'cigna', name: 'Cigna / Evernorth', color: '#0C713D' },
  { id: 'humana', name: 'Humana', color: '#2D8F47' },
  { id: 'kaiser', name: 'Kaiser Permanente', color: '#006BA6' },
  { id: 'anthem', name: 'Anthem Blue Cross', color: '#1E3A8A' },
  { id: 'molina', name: 'Molina Healthcare', color: '#00843D' },
]

export const INSURANCE_PLANS = {
  uhc: [
    { id: 'uhc-plat', name: 'UHC Choice Plus PPO (Platinum)', type: 'PPO', ded: 0, oop: 2000, coins: 10 },
    { id: 'uhc-gold-ppo', name: 'UHC Choice Plus PPO (Gold)', type: 'PPO', ded: 1500, oop: 5500, coins: 20 },
    { id: 'uhc-gold-epo', name: 'UHC Navigate EPO (Gold)', type: 'EPO', ded: 1750, oop: 5500, coins: 20 },
    { id: 'uhc-silver', name: 'UHC Navigate HMO (Silver)', type: 'HMO', ded: 5900, oop: 9200, coins: 25 },
    { id: 'uhc-bronze', name: 'UHC Deductible-Only Bronze PPO', type: 'PPO', ded: 7000, oop: 9200, coins: 40 },
    { id: 'uhc-hdhp', name: 'UHC HDHP (HSA-Eligible)', type: 'HDHP', ded: 2000, oop: 8300, coins: 20 },
    { id: 'uhc-copay', name: 'UHC Copay Select PPO', type: 'PPO', ded: 1000, oop: 5000, coins: 20 },
  ],
  bcbs: [
    { id: 'bcbs-plat', name: 'BCBS Blue Preferred PPO (Platinum)', type: 'PPO', ded: 0, oop: 2500, coins: 10 },
    { id: 'bcbs-gold-ppo', name: 'BCBS PPO Gold Plus', type: 'PPO', ded: 1500, oop: 5500, coins: 20 },
    { id: 'bcbs-gold-hmo', name: 'BCBS Blue Focus HMO (Gold)', type: 'HMO', ded: 1200, oop: 5000, coins: 20 },
    { id: 'bcbs-silver', name: 'BCBS Blue Select PPO (Silver)', type: 'PPO', ded: 5900, oop: 9200, coins: 30 },
    { id: 'bcbs-bronze', name: 'BCBS Blue Value HMO (Bronze)', type: 'HMO', ded: 7000, oop: 9200, coins: 40 },
    { id: 'bcbs-hdhp', name: 'BCBS Blue HDHP (HSA-Compatible)', type: 'HDHP', ded: 2800, oop: 8300, coins: 20 },
    { id: 'bcbs-ppos', name: 'BCBS BlueCard PPO Saver', type: 'PPO', ded: 4500, oop: 9200, coins: 35 },
    { id: 'bcbs-epo', name: 'BCBS Blue Essentials EPO', type: 'EPO', ded: 2000, oop: 7000, coins: 25 },
  ],
  ambetter: [
    { id: 'amb-plat', name: 'Ambetter Secure Care (Platinum)', type: 'HMO', ded: 0, oop: 2000, coins: 10 },
    { id: 'amb-gold', name: 'Ambetter Balanced Care (Gold)', type: 'HMO', ded: 1000, oop: 5000, coins: 20 },
    { id: 'amb-silver', name: 'Ambetter Essential Care (Silver)', type: 'HMO', ded: 5000, oop: 9200, coins: 30 },
    { id: 'amb-silver-csr', name: 'Ambetter Essential Care + CSR 87', type: 'HMO', ded: 750, oop: 3500, coins: 15 },
    { id: 'amb-bronze', name: 'Ambetter Standard Care (Bronze)', type: 'HMO', ded: 7500, oop: 9200, coins: 40 },
    { id: 'amb-hdhp', name: 'Ambetter Secure Care HDHP (HSA)', type: 'HDHP', ded: 1650, oop: 8300, coins: 20 },
    { id: 'amb-expanded', name: 'Ambetter Expanded Bronze HMO', type: 'HMO', ded: 6000, oop: 9200, coins: 40 },
  ],
  aetna: [
    { id: 'aetna-plat', name: 'Aetna Open Choice PPO (Platinum)', type: 'PPO', ded: 0, oop: 2000, coins: 10 },
    { id: 'aetna-gold-ppo', name: 'Aetna Open Access Select (Gold)', type: 'PPO', ded: 1500, oop: 5500, coins: 20 },
    { id: 'aetna-gold-hmo', name: 'Aetna HMO (Gold)', type: 'HMO', ded: 1200, oop: 5000, coins: 20 },
    { id: 'aetna-silver', name: 'Aetna Managed Choice POS (Silver)', type: 'POS', ded: 5500, oop: 9200, coins: 30 },
    { id: 'aetna-bronze', name: 'Aetna Bronze PPO', type: 'PPO', ded: 7000, oop: 9200, coins: 40 },
    { id: 'aetna-hdhp', name: 'Aetna Savings Plus (HSA-Eligible)', type: 'HDHP', ded: 1650, oop: 8300, coins: 20 },
    { id: 'aetna-epo', name: 'Aetna Elect Choice EPO', type: 'EPO', ded: 2000, oop: 7000, coins: 25 },
  ],
  cigna: [
    { id: 'cigna-plat', name: 'Cigna Connect PPO (Platinum)', type: 'PPO', ded: 0, oop: 2000, coins: 10 },
    { id: 'cigna-gold', name: 'Cigna Connect PPO (Gold)', type: 'PPO', ded: 1800, oop: 5500, coins: 20 },
    { id: 'cigna-gold-hmo', name: 'Cigna LocalPlus HMO (Gold)', type: 'HMO', ded: 1500, oop: 5000, coins: 20 },
    { id: 'cigna-silver', name: 'Cigna LocalPlus HMO (Silver)', type: 'HMO', ded: 5500, oop: 9200, coins: 30 },
    { id: 'cigna-bronze', name: 'Cigna Bronze PPO', type: 'PPO', ded: 7000, oop: 9200, coins: 40 },
    { id: 'cigna-hdhp', name: 'Cigna HDHP / HSA Plan', type: 'HDHP', ded: 3000, oop: 8300, coins: 20 },
    { id: 'cigna-epo', name: 'Cigna Network Flex EPO', type: 'EPO', ded: 2200, oop: 7000, coins: 25 },
    { id: 'cigna-oa', name: 'Cigna Open Access Plus PPO', type: 'PPO', ded: 1000, oop: 4500, coins: 15 },
  ],
  humana: [
    { id: 'humana-plat', name: 'Humana Platinum PPO', type: 'PPO', ded: 0, oop: 2500, coins: 10 },
    { id: 'humana-gold', name: 'Humana Gold Plus HMO', type: 'HMO', ded: 1200, oop: 5000, coins: 20 },
    { id: 'humana-gold-ppo', name: 'Humana Choice PPO (Gold)', type: 'PPO', ded: 1800, oop: 5500, coins: 20 },
    { id: 'humana-silver', name: 'Humana HMO Silver', type: 'HMO', ded: 5000, oop: 9200, coins: 30 },
    { id: 'humana-bronze', name: 'Humana Bronze PPO', type: 'PPO', ded: 7000, oop: 9200, coins: 40 },
    { id: 'humana-hdhp', name: 'Humana HDHP with HSA', type: 'HDHP', ded: 1650, oop: 8300, coins: 20 },
    { id: 'humana-spirit', name: 'Humana Spirit Value PPO', type: 'PPO', ded: 2500, oop: 7500, coins: 30 },
  ],
  kaiser: [
    { id: 'kaiser-plat', name: 'Kaiser Permanente Platinum HMO', type: 'HMO', ded: 0, oop: 1500, coins: 10 },
    { id: 'kaiser-gold', name: 'Kaiser Permanente Gold HMO', type: 'HMO', ded: 0, oop: 3000, coins: 20 },
    { id: 'kaiser-silver', name: 'Kaiser Permanente Silver HMO', type: 'HMO', ded: 2000, oop: 8150, coins: 30 },
    { id: 'kaiser-bronze', name: 'Kaiser Permanente Bronze HMO', type: 'HMO', ded: 6000, oop: 9200, coins: 40 },
    { id: 'kaiser-hdhp', name: 'Kaiser Permanente HDHP (HSA)', type: 'HDHP', ded: 1650, oop: 8300, coins: 20 },
    { id: 'kaiser-deduct', name: 'Kaiser Permanente Deductible Silver', type: 'HMO', ded: 4500, oop: 9200, coins: 30 },
  ],
  anthem: [
    { id: 'anthem-plat', name: 'Anthem Blue Cross Platinum PPO', type: 'PPO', ded: 0, oop: 2500, coins: 10 },
    { id: 'anthem-gold', name: 'Anthem Gold Select PPO', type: 'PPO', ded: 1500, oop: 5500, coins: 20 },
    { id: 'anthem-gold-hmo', name: 'Anthem HMO Gold', type: 'HMO', ded: 1000, oop: 5000, coins: 20 },
    { id: 'anthem-silver', name: 'Anthem Silver PPO', type: 'PPO', ded: 5500, oop: 9200, coins: 30 },
    { id: 'anthem-bronze', name: 'Anthem Bronze PPO', type: 'PPO', ded: 7000, oop: 9200, coins: 40 },
    { id: 'anthem-hdhp', name: 'Anthem HDHP (HSA-Eligible)', type: 'HDHP', ded: 1650, oop: 8300, coins: 20 },
    { id: 'anthem-epo', name: 'Anthem Blue Cross EPO', type: 'EPO', ded: 2000, oop: 7000, coins: 25 },
    { id: 'anthem-medi', name: 'Anthem Pathway HMO (Budget Silver)', type: 'HMO', ded: 4500, oop: 9200, coins: 35 },
  ],
  molina: [
    { id: 'molina-plat', name: 'Molina Marketplace Platinum', type: 'HMO', ded: 0, oop: 2000, coins: 10 },
    { id: 'molina-gold', name: 'Molina Marketplace Gold HMO', type: 'HMO', ded: 500, oop: 4500, coins: 20 },
    { id: 'molina-silver', name: 'Molina Marketplace Silver HMO', type: 'HMO', ded: 4500, oop: 9200, coins: 30 },
    { id: 'molina-silver2', name: 'Molina MyChoice Silver (HDHP-style)', type: 'HDHP', ded: 3000, oop: 9200, coins: 30 },
    { id: 'molina-bronze', name: 'Molina Marketplace Bronze HMO', type: 'HMO', ded: 7000, oop: 9200, coins: 40 },
    { id: 'molina-expanded', name: 'Molina Expanded Bronze HMO', type: 'HMO', ded: 5500, oop: 9200, coins: 35 },
  ],
}

/** @type {Record<string, number>} */
export const PLAN_COUNT_BY_CARRIER = Object.fromEntries(
  Object.entries(INSURANCE_PLANS).map(([k, arr]) => [k, arr.length]),
)
