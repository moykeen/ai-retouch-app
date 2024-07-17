import json
from logic_user_usage import UserUsage, validate_admin_user
from logic_server_controller import notify_line


def lambda_handler(event, context):
    if not validate_admin_user(event["headers"]["authorization"]):
        return {"statusCode": 404, "body": json.dumps("only root can control")}

    body = json.loads(event["body"])
    duration = int(body["duration"])
    user_usage = UserUsage()
    user_usage.set_auto_termination(duration)
    notify_line(f"set auto termination {duration} sec.")

    return {
        "statusCode": 200,
        "body": json.dumps("done"),
    }
