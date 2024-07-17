import json
from urllib import request
import base64
import os
from io import BytesIO
from PIL import Image
from logic_user_usage import UserUsage


def lambda_handler(event, context):
    user_usage = UserUsage(event)
    usage = user_usage.get_user_usage()

    remaining_credit = int(usage["credit"])
    credit_consumption = int(os.environ["CREDIT_CONSUMPTION"])
    if remaining_credit < credit_consumption:
        return {
            "statusCode": 400,
            "body": json.dumps("no sufficient credits remain"),
        }

    base_url = os.environ["SD_SERVER_URL"]
    img_str = event["body"]
    data = {
        "controlnet_module": "lineart",
        "controlnet_input_images": [img_str],
        "controlnet_processor_res": 512,
        "controlnet_threshold_a": 64,
        "controlnet_threshold_b": 64,
    }
    url = base_url + "/controlnet/detect-only"
    headers = {"Content-Type": "application/json"}

    with request.urlopen(
        request.Request(url, json.dumps(data).encode(), headers)
    ) as res:
        body = res.read()
    body = json.loads(body)

    detected_image = Image.open(BytesIO(base64.b64decode(body["images"][0])))
    detected_image = detected_image.convert("L")
    # gave-up making transparent
    # detected_image_np = np.array(detected_image)
    # detected_image_alpha = (detected_image_np > 0) * 255
    # detected_image = Image.fromarray(
    #     np.stack([detected_image_np] * 3 + [detected_image_alpha], -1).astype("uint8"),
    #     mode="RGBA",
    # )

    buffered = BytesIO()
    detected_image.save(buffered, format="PNG")
    result_img_str = base64.b64encode(buffered.getvalue()).decode()

    # tag
    data = {
        "image": img_str,
        "model": "wd-v1-4-moat-tagger.v2",
        "threshold": 0.35,
        "queue": "",
        "name_in_queue": "",
    }
    url = base_url + "/tagger/v1/interrogate"
    with request.urlopen(
        request.Request(url, json.dumps(data).encode(), headers)
    ) as res:
        body = res.read()
    tagging_result = json.loads(body)

    if credit_consumption != 0:
        remaining_credit -= credit_consumption
        user_usage.update_user_credit(remaining_credit)

    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "image": result_img_str,
                "taggingResult": tagging_result,
                "remainingCredit": remaining_credit,
            }
        ),
    }
