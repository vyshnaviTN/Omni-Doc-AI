from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database.core import get_db
from database import models

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/")
def get_analytics(db: Session = Depends(get_db)):
    doc_count = db.query(models.Document).count()
    query_count = db.query(models.AnalyticsEvent).filter(models.AnalyticsEvent.event_type == "query").count()
    
    # Calculate average response time
    avg_response_time = db.query(func.avg(models.AnalyticsEvent.response_time_ms)).filter(
        models.AnalyticsEvent.event_type == "query",
        models.AnalyticsEvent.response_time_ms.isnot(None)
    ).scalar() or 0
    
    # Group by queries (basic implementation for "most common queries")
    common_queries = db.query(
        models.AnalyticsEvent.query_text, 
        func.count(models.AnalyticsEvent.id).label('count')
    ).filter(
        models.AnalyticsEvent.event_type == "query"
    ).group_by(
        models.AnalyticsEvent.query_text
    ).order_by(
        func.count(models.AnalyticsEvent.id).desc()
    ).limit(5).all()

    return {
        "total_documents": doc_count,
        "total_queries": query_count,
        "average_response_time_ms": round(avg_response_time, 2),
        "most_common_queries": [{"query": q[0], "count": q[1]} for q in common_queries if q[0]]
    }
