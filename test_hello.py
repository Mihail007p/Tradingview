import unittest

from hello import greet


class TestGreet(unittest.TestCase):
    def test_default_name(self):
        self.assertEqual(greet(), "Hello, world!")

    def test_custom_name(self):
        self.assertEqual(greet("Mihail"), "Hello, Mihail!")

    def test_strips_whitespace(self):
        self.assertEqual(greet("  Mihail  "), "Hello, Mihail!")

    def test_empty_name_raises(self):
        with self.assertRaises(ValueError):
            greet("")

    def test_whitespace_only_name_raises(self):
        with self.assertRaises(ValueError):
            greet("   ")

    def test_none_name_raises(self):
        with self.assertRaises(ValueError):
            greet(None)


if __name__ == "__main__":
    unittest.main()
