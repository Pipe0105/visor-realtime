import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Settings:
    PROJECT_NAME: str = "Visor Realtime"
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: str = os.getenv("DB_PORT", "5432")
    DB_NAME: str = os.getenv("DB_NAME", "visor_realtime")
    DB_USER: str = os.getenv("DB_USER", "postgres")
    DB_PASS: str = os.getenv("DB_PASS", "1234")
    INVOICE_PATH: str = os.getenv("INVOICE_PATH", r"\\192.168.32.100\prt")
    INVOICE_FILE_PREFIX: str = os.getenv("INVOICE_FILE_PREFIX", "010012W")
    INVOICE_POLL_INTERVAL: float = float(os.getenv("INVOICE_POLL_INTERVAL", "5"))

    @property
    def DATABASE_URL(self):
        return f"postgresql://{self.DB_USER}:{self.DB_PASS}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

settings = Settings()
