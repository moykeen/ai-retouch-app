import json
import os
from logic_user_usage import UserUsage


def lambda_handler(event, context):
    user_usage = UserUsage(event)
    usage = user_usage.get_user_usage()

    if usage is None:
        plan = os.environ["PLAN_NAME_FREE"]
        credit = int(os.environ["FULL_CREDIT_FREE"])
        user_usage.initialize_user_usage(credit, plan)

    else:
        credit = int(usage["credit"])
        plan = usage["plan"]

    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "username": user_usage.username,
                "credit": credit,
                "plan": plan,
            }
        ),
    }
