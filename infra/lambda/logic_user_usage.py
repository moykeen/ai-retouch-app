from decimal import Decimal
import boto3
from boto3.dynamodb.conditions import Attr
import os
import json
import base64
from typing import Optional
from datetime import datetime


def extract_username(auth_token):
    def _decode_token(s):
        return json.loads(base64.b64decode(s + "=" * (-len(s) % 4)).decode())

    token_payload = auth_token.split(".")[1]
    username = _decode_token(token_payload)["username"]
    return username


def validate_admin_user(auth_token):
    return extract_username(auth_token) == "root"


class UserUsage:
    def __init__(self, event: Optional[dict] = None):
        dynamodb = boto3.resource("dynamodb")
        table_name = os.environ["DYNAMO_TABLE_NAME"]
        self._table = dynamodb.Table(table_name)
        if event is not None:
            self._username = extract_username(event["headers"]["authorization"])

    @property
    def username(self):
        return self._username

    @username.setter
    def username(self, username):
        self._username = username

    def get_user_usage(self):
        response = self._table.get_item(Key={"pk": self._username, "sk": "info"})
        item = response.get("Item")
        return item

    def initialize_user_usage(self, credit: int, plan: str):
        item = {
            "pk": self._username,
            "sk": "info",
            "credit": Decimal(credit),
            "plan": plan,
        }
        self._table.put_item(Item=item)

    def update_user_credit(self, credit: int):
        self._table.update_item(
            Key={"pk": self._username, "sk": "info"},
            AttributeUpdates={"credit": {"Value": Decimal(credit), "Action": "PUT"}},
        )

    def scan_user_infos(self):
        response = self._table.scan(
            Select="ALL_ATTRIBUTES",
            FilterExpression=Attr("sk").eq("info"),
        )
        items = response.get("Items")
        return items

    def update_last_called(self, ts: Optional[float] = None):
        if ts is None:
            ts = datetime.utcnow().timestamp()
        self._table.update_item(
            Key={"pk": "GLOBAL", "sk": "lastCalled"},
            AttributeUpdates={
                "calledAt": {"Value": Decimal(ts), "Action": "PUT"},
                "calledBy": {"Value": self.username, "Action": "PUT"},
            },
        )

    def get_last_called(self) -> Optional[float]:
        response = self._table.get_item(Key={"pk": "GLOBAL", "sk": "lastCalled"})
        item = response.get("Item")
        if item:
            called = item.get("calledAt")
            if called:
                return float(called)
        return None

    def get_auto_termination(self) -> Optional[int]:
        response = self._table.get_item(Key={"pk": "GLOBAL", "sk": "autoTermination"})
        item = response.get("Item")
        if item:
            duration = item.get("duration")
            if duration:
                return int(duration)
        return None

    def set_auto_termination(self, duration: int):
        self._table.update_item(
            Key={"pk": "GLOBAL", "sk": "autoTermination"},
            AttributeUpdates={
                "duration": {"Value": Decimal(duration), "Action": "PUT"}
            },
        )
