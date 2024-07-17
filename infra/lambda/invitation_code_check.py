N = 1893


def lambda_handler(event, context):
    try:
        invitation_code = int(event["request"]["userAttributes"]["custom:invitation"])
        assert invitation_code % N == 0
    except (ValueError, KeyError, AssertionError):
        raise Exception("You don't have valid invitation code.")

    return event
