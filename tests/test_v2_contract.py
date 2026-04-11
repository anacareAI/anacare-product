import unittest

from backend.main import app


class TestV2Contract(unittest.TestCase):
    def test_v2_routes_registered(self):
        paths = {r.path for r in app.routes}
        self.assertIn("/v2/search/hospitals", paths)
        self.assertIn("/v2/providers/{ccn}/episode", paths)
        self.assertIn("/v2/plans/{plan_id}/benefits", paths)
        self.assertIn("/v2/procedures/search", paths)
        self.assertIn("/v2/places/search", paths)


if __name__ == "__main__":
    unittest.main()
