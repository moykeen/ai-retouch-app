import os
from logic_user_usage import UserUsage


def lambda_handler(event, context):
    user_usage = UserUsage()
    user_infos = user_usage.scan_user_infos()

    n_updated = 0
    for user_info in user_infos:
        plan = user_info["plan"]
        credit = int(user_info["credit"])

        if plan == os.environ["PLAN_NAME_FREE"]:
            full_credit = int(os.environ["FULL_CREDIT_FREE"])
        elif plan == os.environ["PLAN_NAME_STANDARD"]:
            full_credit = int(os.environ["FULL_CREDIT_STANDARD"])
        else:
            full_credit = 10000

        if credit == full_credit:
            continue

        user_usage.username = user_info["pk"]
        user_usage.update_user_credit(full_credit)
        n_updated += 1

    return f"refreshed {n_updated} users' credit"
