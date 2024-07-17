import json
from logic_user_usage import UserUsage, validate_admin_user
from logic_server_controller import ServerController, notify_line


def lambda_handler(event, context):
    command = event["body"]
    server_controller = ServerController()
    instance = server_controller.target_instance

    success = False
    if command == "start":
        if server_controller.get_target_instance_status() == "STOPPED":
            instance.start()
            print("instance started")
            notify_line("instance start")
            user_usage = UserUsage(event)
            user_usage.update_last_called()
            print("updated last usage")
            result = "successfully start"
            success = True
        else:
            result = "cannot start the server which is not stopped"

    elif command == "stop":
        if not validate_admin_user(event["headers"]["authorization"]):
            result = "only admin user can stop service server"

        if server_controller.get_target_instance_status() == "RUNNING":
            instance.stop()
            notify_line("instance stop")
            result = "successfully stop"
            success = True
        else:
            result = "cannot stop the server which is not running"

    else:
        result = "unknown command"

    return {
        "statusCode": 200 if success else 400,
        "body": json.dumps(result),
    }
