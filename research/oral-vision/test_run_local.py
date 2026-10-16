import unittest
from run_local import normalized_box, validate_manifest

class SafetyTests(unittest.TestCase):
    def test_coordinates(self):
        self.assertEqual(normalized_box([10, 20, 30, 40], 100, 200),dict(xmin=100, ymin=100, xmax=300, ymax=200))
    def test_reject_bad_coordinates(self):
        for box in ([10, 10, 5, 5], [-1, 0, 10, 10], [0, 0, float('nan'), 10]):
            with self.assertRaises(ValueError): normalized_box(box, 100, 100)
    def test_reject_unapproved(self):
        with self.assertRaises(ValueError): validate_manifest({'architecture':'RFDETRLarge'})
    def test_no_plus_models(self):
        with self.assertRaises(ValueError): validate_manifest({'architecture':'RFDETRXLarge'})

if __name__ == '__main__': unittest.main()
