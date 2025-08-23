from typing import Literal
from pydantic import Field
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

import logging

LOG_DEFAULT_FORMAT = '[%(asctime)s] %(name)-35s:%(lineno)-3d - %(levelname)-7s - %(message)s'

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class AppBaseConfig:
    """Базовый класс для конфигурации с общими настройками"""
    case_sensitive = False
    env_file_encoding = "utf-8"
    env_nested_delimiter="__"
    extra = "ignore"
    
    @classmethod
    def get_env_file(cls) -> str:
        """Автоматически выбирает файл окружения"""
        import os
        
        # Проверяем переменную окружения ENVIRONMENT
        env = os.getenv("ENVIRONMENT", "development").lower()
        
        if env == "production":
            return "/app/settings/prod.env"
        elif env == "development":
            return "/app/settings/dev.env"
        else:
            # Fallback на development
            return "/app/settings/dev.env"


class RunConfig(BaseSettings):
    model_config = SettingsConfigDict(
        **AppBaseConfig.__dict__, 
        env_prefix="RUN__",
        env_file=AppBaseConfig.get_env_file()
    )

    domain: str = Field(default="localhost")
    
    host: str = Field(default="localhost")
    port: int = Field(default=8000)
    reload: bool = Field(default=False)

    celery_broker_url: str = Field(default="amqp://ai_control_user:ai_control_password@rabbitmq:5672//")
    celery_result_backend: str = Field(default="redis://redis:6379/0")

    frontend_host: str = Field(default="localhost")
    frontend_port: int = Field(default=5173)

    @property
    def frontend_url(self):
        return f"http://{self.frontend_host}:{self.frontend_port}"
    
    @property
    def https_frontend_url(self):
        return f"https://{self.frontend_host}:{self.frontend_port}"

    @property
    def http_domain_frontend_url(self):
        return f"http://{self.domain}:{self.frontend_port}"
    
    @property
    def https_domain_frontend_url(self):
        return f"https://{self.domain}:{self.frontend_port}"

class LoggingConfig(BaseSettings):
    
    model_config = SettingsConfigDict(
        **AppBaseConfig.__dict__, 
        env_prefix="LOGGING__",
        env_file=AppBaseConfig.get_env_file()
    )
    
    level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = Field(default="INFO")
    format: str = LOG_DEFAULT_FORMAT
    
    access_log: bool = Field(default=True)

    @property
    def log_level(self) -> int:
        return getattr(logging, self.level)


class DatabaseConfig(BaseSettings):

    model_config = SettingsConfigDict(
        **AppBaseConfig.__dict__, 
        env_prefix="POSTGRES__",
        env_file=AppBaseConfig.get_env_file()
    )
    
    user: str = Field(default="ai_control_user")
    password: str = Field(default="ai_control_password")
    host: str = Field(default="localhost")
    # host_alt: str = Field(default="localhost")
    db_name: str = Field(default="ai_control_dev")
    port: int = Field(default=5432)

    echo: bool = Field(default=False)
    echo_pool: bool = Field(default=False)
    pool_size: int = Field(default=20)
    max_overflow: int = 10
    pool_timeout: int = 30

    naming_convention: dict[str, str] = {
        "ix": "ix_%(column_0_label)s",
        "uq": "uq_%(table_name)s_%(column_0_N_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s",
    }
    
    def get_url(self) -> str:
        return f"postgresql+asyncpg://{self.user}:{self.password}@{self.host}:{self.port}/{self.db_name}"
    
    def get_url_alt(self) -> str:
        return f"postgresql+asyncpg://{self.user}:{self.password}@{self.host_alt}:{self.port}/{self.db_name}"


class RabbitMQConfig(BaseSettings):

    model_config = SettingsConfigDict(
        **AppBaseConfig.__dict__, 
        env_prefix="RABBITMQ__",
        env_file=AppBaseConfig.get_env_file()
    )
    
    host: str = Field(default="localhost")
    port: int = Field(default=5672)
    user: str = Field(default="guest")
    password: str = Field(default="guest")

class SecurityCongig(BaseSettings):
    model_config = SettingsConfigDict(
        **AppBaseConfig.__dict__, 
        env_prefix="SECURITY__",
        env_file=AppBaseConfig.get_env_file()
    )

    private_key_path: Path = BASE_DIR / "ssl" / "privkey.pem"
    public_key_path: Path = BASE_DIR / "ssl" / "pubkey.pem"
    certificate_path: Path = BASE_DIR / "ssl" / "certificate.pem"

    secret_key: str = Field(default="dev-secret-key-change-in-production")
    refresh_secret_key: str = Field(default="dev-refresh-secret-key-change-in-production")
    algorithm: str = Field(default="HS256")

    access_token_expire_minutes: int = Field(default=120)
    refresh_token_expire_days:int = Field(default=7)


class Config(BaseSettings):

    model_config = SettingsConfigDict(
        **AppBaseConfig.__dict__,
        env_file=AppBaseConfig.get_env_file()
    )

    debug: bool = Field(default=True)

    security: SecurityCongig = Field(default_factory=SecurityCongig)

    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    db: DatabaseConfig = Field(default_factory=DatabaseConfig)
    rbmq: RabbitMQConfig = Field(default_factory=RabbitMQConfig)
    run: RunConfig = Field(default_factory=RunConfig)

settings = Config()