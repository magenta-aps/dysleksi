from dataclasses import dataclass, field
from datetime import date, datetime
from typing import List

from dataclasses_json import config, dataclass_json
from marshmallow import fields


@dataclass_json
@dataclass
class Person:
    FirstName: str | None
    FamilyName: str
    UserId: str


@dataclass_json
@dataclass
class Student:
    Role: str
    StudentNumber: str
    Level: str
    Location: str
    MainGroupId: str
    GroupId: List[str]


@dataclass_json
@dataclass
class Employee:
    Role: str | List[str]
    ShortName: str
    Occupation: str
    Location: str
    GroupId: List[str]


@dataclass_json
@dataclass
class Extern:
    Role: str
    GroupId: List[str]


@dataclass_json
@dataclass
class InstitutionPerson:
    Person: Person
    Student: Student | None
    Employee: Employee | None
    Extern: Extern | None
    source: str


@dataclass_json
@dataclass
class Group:
    GroupId: str
    GroupName: str
    GroupType: str
    GroupLevel: int | None
    Line: str | None
    FromDate: date | None
    ToDate: date | None


@dataclass_json
@dataclass
class Institution:
    InstitutionNumber: str
    InstitutionName: str
    Group: List[Group]
    InstitutionPerson: List[InstitutionPerson]


@dataclass_json
@dataclass
class Source:
    sourceDateTime: datetime = field(
        metadata=config(
            encoder=datetime.isoformat,
            decoder=datetime.fromisoformat,
            mm_field=fields.DateTime(format="iso"),
        )
    )
    source: str
    schoolYear: str


@dataclass_json
@dataclass
class Export:
    ImportSource: List[Source]
    Institution: Institution
    exportDateTime: datetime = field(
        metadata=config(
            encoder=datetime.isoformat,
            decoder=datetime.fromisoformat,
            mm_field=fields.DateTime(format="iso"),
        )
    )
    accessLevel: str
