from typing import Literal

from pydantic.dataclasses import dataclass



@dataclass
class FileEntry:
    file_name: str
    text: str
    expiration_time: int
    has_file: bool = False
    instant_expire: bool = False
    ip_address: str = None

@dataclass
class FetchInfoSuccess:
    unique_id: str
    id_present: bool
    text: str
    filename: str | None = None
    filesize: int | None = None
    success: bool = True

@dataclass
class FetchInfoFailure:
    unique_id: str
    error_msg: str
    success = False


