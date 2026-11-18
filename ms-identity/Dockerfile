FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8001
ENV SERVICE_NAME=identity

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY ms-identity/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY shared ./shared
COPY ms-identity/ms_identity ./ms_identity

EXPOSE 8001

CMD ["sh", "-c", "uvicorn ms_identity.main:app --host 0.0.0.0 --port ${PORT:-8001}"]
