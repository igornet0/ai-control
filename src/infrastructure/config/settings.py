"""
Application settings using Pydantic Settings.
Provides type-safe configuration management.
"""

from functools import lru_cache
from typing import List, Optional

from pydantic import Field, validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseSettings(BaseSettings):
    """Database configuration settings."""
    
    model_config = SettingsConfigDict(env_prefix="DB_")
    
    host: str = Field(default="localhost", description="Database host")
    port: int = Field(default=5432, description="Database port")
    name: str = Field(default="ai_control", description="Database name")
    user: str = Field(default="ai_control_user", description="Database user")
    password: str = Field(default="ai_control_password", description="Database password")
    pool_size: int = Field(default=10, description="Connection pool size")
    max_overflow: int = Field(default=20, description="Max overflow connections")
    echo: bool = Field(default=False, description="Echo SQL queries")
    
    @property
    def url(self) -> str:
        """Get database URL."""
        return f"postgresql+asyncpg://{self.user}:{self.password}@{self.host}:{self.port}/{self.name}"


class RedisSettings(BaseSettings):
    """Redis configuration settings."""
    
    model_config = SettingsConfigDict(env_prefix="REDIS_")
    
    host: str = Field(default="localhost", description="Redis host")
    port: int = Field(default=6379, description="Redis port")
    db: int = Field(default=0, description="Redis database number")
    password: Optional[str] = Field(default=None, description="Redis password")
    max_connections: int = Field(default=10, description="Max Redis connections")
    
    @property
    def url(self) -> str:
        """Get Redis URL."""
        auth = f":{self.password}@" if self.password else ""
        return f"redis://{auth}{self.host}:{self.port}/{self.db}"


class RabbitMQSettings(BaseSettings):
    """RabbitMQ configuration settings."""
    
    model_config = SettingsConfigDict(env_prefix="RABBITMQ_")
    
    host: str = Field(default="localhost", description="RabbitMQ host")
    port: int = Field(default=5672, description="RabbitMQ port")
    user: str = Field(default="ai_control_user", description="RabbitMQ user")
    password: str = Field(default="ai_control_password", description="RabbitMQ password")
    vhost: str = Field(default="/", description="RabbitMQ virtual host")
    
    @property
    def url(self) -> str:
        """Get RabbitMQ URL."""
        return f"amqp://{self.user}:{self.password}@{self.host}:{self.port}{self.vhost}"


class SecuritySettings(BaseSettings):
    """Security configuration settings."""
    
    model_config = SettingsConfigDict(env_prefix="SECURITY_")
    
    secret_key: str = Field(..., description="Secret key for JWT tokens")
    algorithm: str = Field(default="HS256", description="JWT algorithm")
    access_token_expire_minutes: int = Field(default=30, description="Access token expiration")
    refresh_token_expire_days: int = Field(default=7, description="Refresh token expiration")
    password_min_length: int = Field(default=8, description="Minimum password length")
    password_require_uppercase: bool = Field(default=True, description="Require uppercase in password")
    password_require_lowercase: bool = Field(default=True, description="Require lowercase in password")
    password_require_numbers: bool = Field(default=True, description="Require numbers in password")
    password_require_special: bool = Field(default=True, description="Require special chars in password")


class APISettings(BaseSettings):
    """API configuration settings."""
    
    model_config = SettingsConfigDict(env_prefix="API_")
    
    title: str = Field(default="AI Control System", description="API title")
    version: str = Field(default="1.0.0", description="API version")
    description: str = Field(default="AI-powered enterprise management system", description="API description")
    docs_url: str = Field(default="/docs", description="Swagger UI URL")
    redoc_url: str = Field(default="/redoc", description="ReDoc URL")
    openapi_url: str = Field(default="/openapi.json", description="OpenAPI schema URL")
    cors_origins: List[str] = Field(default=["http://localhost:3000"], description="CORS origins")
    cors_allow_credentials: bool = Field(default=True, description="Allow CORS credentials")
    cors_allow_methods: List[str] = Field(default=["*"], description="Allowed CORS methods")
    cors_allow_headers: List[str] = Field(default=["*"], description="Allowed CORS headers")
    
    @validator("cors_origins", pre=True)
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string or list."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v


class LoggingSettings(BaseSettings):
    """Logging configuration settings."""
    
    model_config = SettingsConfigDict(env_prefix="LOG_")
    
    level: str = Field(default="INFO", description="Logging level")
    format: str = Field(default="json", description="Log format (json, console)")
    enable_console: bool = Field(default=True, description="Enable console logging")
    enable_file: bool = Field(default=False, description="Enable file logging")
    file_path: str = Field(default="logs/app.log", description="Log file path")
    max_file_size: int = Field(default=10 * 1024 * 1024, description="Max log file size in bytes")
    backup_count: int = Field(default=5, description="Number of backup log files")


class CelerySettings(BaseSettings):
    """Celery configuration settings."""
    
    model_config = SettingsConfigDict(env_prefix="CELERY_")
    
    broker_url: str = Field(default="redis://localhost:6379/1", description="Celery broker URL")
    result_backend: str = Field(default="redis://localhost:6379/2", description="Celery result backend")
    task_serializer: str = Field(default="json", description="Task serializer")
    result_serializer: str = Field(default="json", description="Result serializer")
    accept_content: List[str] = Field(default=["json"], description="Accepted content types")
    timezone: str = Field(default="UTC", description="Celery timezone")
    enable_utc: bool = Field(default=True, description="Enable UTC")
    task_track_started: bool = Field(default=True, description="Track task start")
    task_time_limit: int = Field(default=30 * 60, description="Task time limit in seconds")
    task_soft_time_limit: int = Field(default=25 * 60, description="Task soft time limit in seconds")


class Settings(BaseSettings):
    """Main application settings."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )
    
    # Environment
    environment: str = Field(default="development", description="Environment (development, production, testing)")
    debug: bool = Field(default=False, description="Debug mode")
    
    # Component settings
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    rabbitmq: RabbitMQSettings = Field(default_factory=RabbitMQSettings)
    security: SecuritySettings = Field(default_factory=SecuritySettings)
    api: APISettings = Field(default_factory=APISettings)
    logging: LoggingSettings = Field(default_factory=LoggingSettings)
    celery: CelerySettings = Field(default_factory=CelerySettings)
    
    # File upload settings
    upload_dir: str = Field(default="uploads", description="Upload directory")
    max_file_size: int = Field(default=10 * 1024 * 1024, description="Max file size in bytes")
    allowed_extensions: List[str] = Field(
        default=[".jpg", ".jpeg", ".png", ".gif", ".pdf", ".doc", ".docx", ".txt"],
        description="Allowed file extensions"
    )
    
    # AI/ML settings
    ai_model_path: Optional[str] = Field(default=None, description="Path to AI model")
    ai_model_config: Optional[str] = Field(default=None, description="AI model configuration")
    
    @validator("environment")
    def validate_environment(cls, v):
        """Validate environment value."""
        allowed = {"development", "production", "testing"}
        if v not in allowed:
            raise ValueError(f"Environment must be one of {allowed}")
        return v
    
    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.environment == "development"
    
    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.environment == "production"
    
    @property
    def is_testing(self) -> bool:
        """Check if running in testing mode."""
        return self.environment == "testing"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
