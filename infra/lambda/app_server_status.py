import json
from urllib import request
from urllib.error import URLError
import os


def lambda_handler(event, context):
    base_url = os.environ["SD_SERVER_URL"]
    url = base_url + "/sdapi/v1/options"  #  arbitrary GET endpoint for healthcheck
    try:
        with request.urlopen(request.Request(url), timeout=2) as res:
            status = "AVAILABLE"
    except URLError as error:
        status = "UNAVAILABLE"

    return {
        "statusCode": 200,
        "body": json.dumps(status),
    }
