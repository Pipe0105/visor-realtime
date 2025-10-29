import os
from typing import List
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def _split_env_list(value: str) -> List[str]:
    """Split a comma separated list from the environment."""

    return [item.strip() for item in value.split(",") if item.strip()]

class Settings:
    PROJECT_NAME: str = "Visor Realtime"
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: str = os.getenv("DB_PORT", "5432")
    DB_NAME: str = os.getenv("DB_NAME", "visor_realtime")
    DB_USER: str = os.getenv("DB_USER", "postgres")
    DB_PASS: str = os.getenv("DB_PASS", "1234")
    INVOICE_PATH: str = os.getenv("INVOICE_PATH", r"\\192.168.32.100\unfe-pdv")
    INVOICE_FILE_PREFIX: str = os.getenv("INVOICE_FILE_PREFIX", "010012W")
    INVOICE_POLL_INTERVAL: float = float(os.getenv("INVOICE_POLL_INTERVAL", "2"))
    INVOICE_PERIODIC_RESCAN_SECONDS: float = float(
        os.getenv("NVOICE_PERIODIC_RESCAN_SECONDS", "120")
    )
    LOCAL_TIMEZONE: str = os.getenv("LOCAL_TIMEZONE", "America/Bogota")

    _cors_allowed_origins: str = os.getenv("CORS_ALLOWED_ORIGINS", "*")
    CORS_ALLOW_CREDENTIALS: bool = os.getenv("CORS_ALLOW_CREDENTIALS", "true").lower() == "true"

    @property
    def DATABASE_URL(self):
        return f"postgresql://{self.DB_USER}:{self.DB_PASS}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def CORS_ALLOW_ALL(self) -> bool:
        return self._cors_allowed_origins.strip() == "*"

    @property
    def CORS_ALLOWED_ORIGINS(self) -> List[str]:
        if self.CORS_ALLOW_ALL:
            return ["*"]
        origins = _split_env_list(self._cors_allowed_origins)
        return origins or ["*"]

settings = Settings()
