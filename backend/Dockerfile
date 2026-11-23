# Stage 1: turn poetry.lock into a pinned, hashed requirements.txt.
# Poetry runs only here, so its own dependencies (certifi, etc.) never share
# site-packages with the app's. Installing both into one environment made
# builds fail intermittently when Poetry's newer certifi was swapped for the
# locked one mid-install.
FROM python:3.11-slim AS requirements

RUN pip install --no-cache-dir poetry==2.3.2 poetry-plugin-export==1.10.2

WORKDIR /src
COPY pyproject.toml poetry.lock ./
RUN poetry export --only main --format requirements.txt --output requirements.txt

# Stage 2: the runtime image. No Poetry; the app's locked dependencies are
# installed into the system Python with plain pip.
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install exactly what poetry.lock pins (hashes checked, no re-resolving),
# then confirm the set is complete and consistent.
COPY --from=requirements /src/requirements.txt ./
RUN pip install --no-cache-dir --no-deps --require-hashes -r requirements.txt \
    && pip check

# Copy application code
COPY . .

# Download spaCy model
RUN python -m spacy download en_core_web_sm

EXPOSE 8000

# Railway/Render/Fly inject $PORT; fall back to 8000 locally
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
