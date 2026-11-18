FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8003
ENV SERVICE_NAME=stores

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY ms-stores/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY shared ./shared
COPY ms-stores/ms_stores ./ms_stores

EXPOSE 8003

CMD ["sh", "-c", "uvicorn ms_stores.main:app --host 0.0.0.0 --port ${PORT:-8003}"]
