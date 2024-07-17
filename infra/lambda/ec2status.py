import json
from logic_server_controller import ServerController
from logic_user_usage import validate_admin_user


def lambda_handler(event, context):
    server_controller = ServerController()
    status = server_controller.get_target_instance_status()

    ip_address = None
    if status == "RUNNING" and validate_admin_user(event["headers"]["authorization"]):
        ip_address = server_controller.get_target_instance_ip_address()

    return {
        "statusCode": 200,
        "body": json.dumps({"status": status, "ip": ip_address}),
    }
