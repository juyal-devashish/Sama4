"""Readers reporting a wrong explanation, and the admin list of reports."""

import uuid

from tests.factories import make_article, make_entity

ADMIN = {"X-Admin-Secret": "test-secret"}


async def test_report_is_stored_and_listed_for_admins(client, db_session):
    async with db_session() as db:
        article = await make_article(db, title="Engines")
        ada = await make_entity(db, name="Ada", article=article)
        await db.commit()

    response = await client.post(
        f"/api/v1/context/{ada.id}/reports",
        json={
            "reason": "wrong_thing",
            "article_id": str(article.id),
            "explanation_text": "Ada is a programming language.",
            "note": "  This story is about the person.  ",
        },
    )
    listed = (await client.get("/api/v1/admin/reports", headers=ADMIN)).json()

    assert (response.status_code, response.json()) == (201, {"status": "received"})
    assert len(listed) == 1
    report = listed[0]
    assert report["entity_name"] == "Ada"
    assert report["article_id"] == str(article.id)
    assert report["explanation_text"] == "Ada is a programming language."
    assert report["note"] == "This story is about the person."
    assert report["status"] == "open"
    assert "ip" not in report


async def test_report_rejects_unknown_reason_and_entity(client, db_session):
    async with db_session() as db:
        ada = await make_entity(db, name="Ada")
        await db.commit()

    bad_reason = await client.post(f"/api/v1/context/{ada.id}/reports", json={"reason": "spam"})
    missing = await client.post(f"/api/v1/context/{uuid.uuid4()}/reports", json={"reason": "other"})

    assert bad_reason.status_code == 422
    assert missing.status_code == 404


async def test_reports_are_rate_limited_per_ip(client, db_session):
    async with db_session() as db:
        ada = await make_entity(db, name="Ada")
        await db.commit()
    ip = {"X-Forwarded-For": "203.0.113.9"}
    url = f"/api/v1/context/{ada.id}/reports"

    codes = [
        (await client.post(url, json={"reason": "other"}, headers=ip)).status_code
        for _ in range(21)
    ]

    assert codes == [201] * 20 + [429]


async def test_admin_reports_needs_the_secret(client):
    assert (await client.get("/api/v1/admin/reports")).status_code == 422
