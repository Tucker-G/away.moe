from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from pydantic.dataclasses import dataclass
from werkzeug.datastructures import FileStorage

from backend.models import FileEntry


class Database(ABC):
    @abstractmethod
    def entry_present(self, unique_id: str):
        raise NotImplementedError

    @abstractmethod
    def retrieve_entry(self, unique_id: str) -> FileEntry | None:
        raise NotImplementedError

    @abstractmethod
    def add_to_database(self, unique_id, file_entry, file: FileStorage | None = None):
        raise NotImplementedError

    @abstractmethod
    def retrieve_file_path(self, unique_id: str) -> Path:
        raise NotImplementedError

    @abstractmethod
    def delete_from_database(self, unique_id: str):
        raise NotImplementedError

    @classmethod
    def check_expired(cls, entry: FileEntry) -> bool:
        return datetime.now().timestamp() > entry.expiration_time

    # @abstractmethod
    # def retrieve_file(self, unique_id: str) -> Path:
    #     raise NotImplementedError

    # @abstractmethod
    # def retrieve_file_name(self, unique_id: str) -> str:
    #     raise NotImplementedError

    # @abstractmethod
    # def retrieve_text(self, unique_id: str) -> str:
    #     raise NotImplementedError
    #
    # @abstractmethod
    # def check_expired(self, unique_id: str) -> bool:
    #     raise NotImplementedError
    #
    # @abstractmethod
    # def get_instant_expire(self, unique_id: str) -> bool:
    #     raise NotImplementedError



