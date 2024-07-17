import boto3

import urllib.request
import urllib.parse
import os


def notify_line(msg):
    access_token = os.environ["LINE_NOTIFY_ACCESS_TOKEN"]
    api_url = "https://notify-api.line.me/api/notify"
    headers = {
        "Authorization": "Bearer " + access_token,
        "Content-Type": "application/x-www-form-urlencoded",
    }
    payload = {"message": msg}
    req = urllib.request.Request(
        api_url,
        data=urllib.parse.urlencode(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    res = urllib.request.urlopen(req, timeout=5)


class ServerController:
    def __init__(self):
        self._ec2 = boto3.resource("ec2")
        self._instance = None

    def _find_target_instance(self):
        instances = self._ec2.instances.all()
        for instance in instances:
            for tag in instance.tags:
                if tag["Key"] == "Name" and tag["Value"] == "sd-service":
                    return instance

    @property
    def target_instance(self):
        if self._instance is None:
            self._instance = self._find_target_instance()
        return self._instance

    def get_target_instance_status(self):
        instance = self.target_instance
        return instance.state["Name"].upper()

    def get_target_instance_ip_address(self):
        instance = self.target_instance
        return instance.public_ip_address or "unknown"
