---
name: api-conventions
description: REST API design conventions for the game admin panel
---

# API Conventions

## URL Patterns
- Base: `/api/v1/{resource}`
- List: `GET /api/v1/agents`
- Detail: `GET /api/v1/agents/{id}`
- Create: `POST /api/v1/agents`
- Update: `PUT /api/v1/agents/{id}`
- Delete: `DELETE /api/v1/agents/{id}` (soft delete preferred)

## Query Parameters
- Pagination: `?page=1&page_size=20` (default 20, max 100)
- Search: `?search=keyword`
- Filter: `?status=active&role=agent`
- Sort: `?sort_by=created_at&sort_order=desc`
- Date range: `?start_date=2026-01-01&end_date=2026-02-01`

## Response Format
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "page_size": 20
}
```

## Error Format
```json
{
  "detail": "Error message"
}
```

## Auth Headers
- `Authorization: Bearer {access_token}`
- Token refresh: `POST /api/v1/auth/refresh` with `{refresh_token}`

## Permission Check Pattern
```python
@router.get("/resource")
async def list_resource(
    current_user: AdminUser = Depends(get_current_user),
    _: bool = Depends(PermissionChecker("resource:read")),
    session: AsyncSession = Depends(get_session),
):
```

## Closure Table Scoping
- All agent-scoped queries must filter by closure table
- Use `tree_service.get_descendant_ids(session, agent_id)` for subtree
- Partner API: automatically scoped to current user's subtree
