from app.ingestion.cleaner import CleanerService


def test_cleaner_strips_html():
    cleaner = CleanerService()
    result = cleaner.clean("<p>Hello <b>world</b></p>")
    assert "Hello" in result
    assert "world" in result
    assert "<p>" not in result


def test_reading_time_estimation():
    cleaner = CleanerService()
    text = " ".join(["word"] * 500)
    time = cleaner.estimate_reading_time(text)
    assert time == 2


def test_content_hash():
    cleaner = CleanerService()
    hash1 = cleaner.compute_hash("hello world")
    hash2 = cleaner.compute_hash("hello world")
    hash3 = cleaner.compute_hash("different content")
    assert hash1 == hash2
    assert hash1 != hash3
