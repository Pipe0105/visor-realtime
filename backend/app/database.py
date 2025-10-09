from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# Crear engine y sesión
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Optional: quick connection test
def test_connection():
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version();"))
            version = result.scalar()
            print(f"✅ Connected to PostgreSQL: {version}")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
