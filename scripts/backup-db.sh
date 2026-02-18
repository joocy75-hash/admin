#!/bin/bash
# PostgreSQL backup script for admin-panel
# Usage: ./scripts/backup-db.sh [container_name]

CONTAINER=${1:-admin-panel-db}
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="admin_panel_${DATE}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "Backing up database from container: $CONTAINER"
docker exec "$CONTAINER" pg_dump -U admin admin_panel | gzip > "$BACKUP_DIR/$FILENAME"

if [ $? -eq 0 ]; then
    echo "Backup saved: $BACKUP_DIR/$FILENAME"
    # Delete backups older than 7 days
    find "$BACKUP_DIR" -name "admin_panel_*.sql.gz" -mtime +7 -delete
    echo "Old backups cleaned up (>7 days)"
else
    echo "ERROR: Backup failed!"
    exit 1
fi
