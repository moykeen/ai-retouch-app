from logic_server_controller import ServerController, notify_line
from logic_user_usage import UserUsage
from datetime import datetime


def lambda_handler(event, context):
    server_controller = ServerController()

    if server_controller.get_target_instance_status() == "RUNNING":
        user_usage = UserUsage()
        last_called = user_usage.get_last_called()
        if last_called:
            duration = user_usage.get_auto_termination() or 60 * 40  # in sec
            now = datetime.utcnow().timestamp()
            if now - last_called >= duration:
                server_controller.target_instance.stop()
                notify_line("instance stop")
                print("stopped server")
                return True

            print("server idle time is not long")
        else:
            print("last called time is not available")

    else:
        print("server is not running")

    return False
