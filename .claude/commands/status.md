---
name: status
description: Show project health status (Docker, backend, frontend)
---

Check the overall project health:

1. **Docker**: `docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"` (check db and redis)
2. **Backend**: `curl -s http://localhost:8002/health | python3 -m json.tool` (check health endpoint)
3. **Frontend**: Check if dev server is running on port 3001
4. **DB Migration**: `cd backend && source .venv/bin/activate && PYTHONPATH=. alembic current`

Present results as a status dashboard:
```
Service     | Status  | Details
------------|---------|--------
PostgreSQL  | OK/DOWN | port 5433
Redis       | OK/DOWN | port 6379
Backend API | OK/DOWN | port 8002
Frontend    | OK/DOWN | port 3001
DB Migration| current | version
```
