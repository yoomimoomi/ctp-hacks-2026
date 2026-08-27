#Defining Table

from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from sqlalchemy.sql import func

from database import Base


class Classification(Base):
    __tablename__ = "classifications"

    id = Column(Integer, primary_key=True, index=True)
    item_name = Column(String)
    material_type = Column(String)
    nyc_stream_category = Column(String)
    bin_color = Column(String)
    is_recyclable = Column(Boolean)
    preparation_instructions = Column(JSON)  # list[str] stored as JSON
    nyc_rule_notes = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())