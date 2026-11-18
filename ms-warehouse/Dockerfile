FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8002
ENV SERVICE_NAME=warehouse

# Dependências de sistema necessárias pelo WeasyPrint e healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY ms-warehouse/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY shared ./shared
COPY ms-warehouse/ms_warehouse ./ms_warehouse

EXPOSE 8002

CMD ["sh", "-c", "uvicorn ms_warehouse.main:app --host 0.0.0.0 --port ${PORT:-8002}"]
