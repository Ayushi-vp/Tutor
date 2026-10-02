# Prep Console: build the React UI, then serve UI + API with waitress.
#   docker compose up -d --build        (see docker-compose.yml and the README)

FROM node:20-slim AS ui
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY content /src/content
COPY frontend ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 PORT=5000 PREP_DB=/data/prep.db BACKUP_DIR=/data/backups
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend backend
COPY --from=ui /src/frontend/dist frontend/dist
RUN useradd --system --uid 10001 prep && mkdir /data && chown prep /data
USER prep
VOLUME /data
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/api/health', timeout=4)"
CMD ["python", "backend/app.py"]
