# To use OpenCV in Lambda, this code is written in Python3.8
import json
import boto3
import base64
import os
from urllib import request
from io import BytesIO
from logic_user_usage import UserUsage
import cv2
from PIL import Image
import numpy as np


def upload_file_to_s3(data: bytes, bucket_name: str, key: str):
    s3 = boto3.client("s3")
    s3.upload_fileobj(BytesIO(data), bucket_name, key)


def clean_blob(blob: bytes) -> bytes:
    s = blob.strip().split(b"\r\n")
    return b"\r\n".join(s[3:])


def getBoundary(event_content_type: str) -> bytes:
    boundary = event_content_type.split(";", 1)[1].strip().replace("boundary=", "", 1)
    return ("--" + boundary).encode()


SHORTEST_TARGET = 512


def limit_size(width: int, height: int):  # -> tuple[int, int]:
    if width < height:
        new_width = SHORTEST_TARGET
        new_height = int(new_width / width * height)
    else:
        new_height = SHORTEST_TARGET
        new_width = int(new_height / height * width)

    return new_width, new_height


def lambda_handler(event, context):
    user_usage = UserUsage(event)
    usage = user_usage.get_user_usage()
    user_usage.update_last_called()

    remaining_credit = int(usage["credit"])
    credit_consumption = int(os.environ["CREDIT_CONSUMPTION"])
    if remaining_credit < credit_consumption:
        return {
            "statusCode": 400,
            "body": json.dumps("no sufficient credits remain"),
        }

    body = json.loads(event["body"])

    sampler = body["sampler"]  #  "DPM++ 2M Karras"
    steps = body["steps"]  # 30
    seed = body["seed"]
    width = body["width"]
    height = body["height"]
    mask_blur = body["maskBlur"]
    cfg_scale = body["cfgScale"]
    denosing = body["denosing"]
    initial_noise_multiplier = body["initialNoiseMultiplier"]
    control_mode = body["controlMode"]
    control_weight = body["controlWeight"]
    reference_control_mode = body["referenceControlMode"]
    reference_control_weight = body["referenceControlWeight"]
    inpainting_fill = body["inpaintingFill"]
    img_str = body["imageData"]
    mask_str = body["maskData"]
    edge_str = body["edgeData"]
    positive_prompt = body["positivePrompt"]
    negative_prompt = body["negativePrompt"]
    anti_glare_filter_flag = body["antiGlareFilterFlag"]
    anti_glare_filter_sigma_s = body["antiGlareFilterSigmaS"]
    anti_glare_filter_sigma_r = body["antiGlareFilterSigmaR"]
    use_edge = body["useEdge"]
    use_reference = body["useReference"]
    use_another_image_for_reference = body["useAnotherImageForReference"]
    reference_str = (
        body["referenceImageData"] if use_another_image_for_reference else img_str
    )
    width, height = limit_size(width, height)

    data = {
        "init_images": [img_str],
        "resize_mode": 0,
        "denoising_strength": denosing,
        "image_cfg_scale": 0,
        "mask": mask_str,
        "mask_blur": mask_blur,
        "inpainting_fill": inpainting_fill,
        "inpaint_full_res": 0,  # inpaint area
        "inpaint_full_res_padding": 32,  # no effect when inpaint_full_res = 0
        "inpainting_mask_invert": 0,
        "initial_noise_multiplier": initial_noise_multiplier,
        "prompt": positive_prompt,
        "negative_prompt": negative_prompt,
        "styles": [],
        "seed": seed,
        "subseed": -1,
        "subseed_strength": 0,
        "seed_resize_from_h": 0,
        "seed_resize_from_w": 0,
        "sampler_name": sampler,
        "batch_size": 1,
        "n_iter": 1,
        "steps": steps,
        "cfg_scale": cfg_scale,
        "width": width,
        "height": height,
        "restore_faces": False,
        "tiling": False,
        "do_not_save_samples": False,
        "do_not_save_grid": False,
        "eta": None,  # 0,
        "s_min_uncond": 0,
        "s_churn": 0,
        "s_tmax": 0,
        "s_tmin": 0,
        "s_noise": 1,
        "override_settings": {},
        "override_settings_restore_afterwards": True,
        "script_args": [],
        "sampler_index": sampler,
        "include_init_images": False,
        "script_name": "",
        "send_images": True,
        "save_images": False,
        "alwayson_scripts": {},
    }

    cn_unit_edge = {
        "input_image": edge_str,
        "module": "lineart",
        "model": "control_v11p_sd15_lineart [43d4be0d]",  # this name depends on version, you can look up it on GUI.
        # "module": "canny",
        # "model": "control_v11p_sd15_canny [d14c016b]",
        "weight": control_weight,
        "resize_mode": "Scale to Fit (Inner Fit)",
        "lowvram": False,
        "processor_res": SHORTEST_TARGET,
        "threshold_a": 0.0,
        "threshold_b": 255.0,
        "guidance": 1.0,
        "guidance_start": 0.0,
        "guidance_end": 1.0,
        # "guessmode": False,  # deprecated
        "control_mode": control_mode,
    }

    cn_unit_reference = {
        "input_image": reference_str,
        "module": "reference_only",
        "weight": reference_control_weight,
        "resize_mode": "Scale to Fit (Inner Fit)",
        "lowvram": False,
        "processor_res": SHORTEST_TARGET,
        "threshold_a": 0.0,
        "threshold_b": 255.0,
        "guidance": 1.0,
        "guidance_start": 0.0,
        "guidance_end": 1.0,
        # "guessmode": False,
        "control_mode": reference_control_mode,
    }

    cn_args = {
        "alwayson_scripts": {
            "ControlNet": {
                "args": [
                    cn_unit_edge if use_edge else {"enabled": False},
                    cn_unit_reference if use_reference else {"enabled": False},
                    {"enabled": False},
                    {"enabled": False},
                ]
            }
        }
    }
    data.update(cn_args)

    base_url = os.environ["SD_SERVER_URL"]
    url = base_url + "/sdapi/v1/img2img"
    headers = {
        # "accept": "application/json",
        "Content-Type": "application/json"
    }

    print("issue request")
    with request.urlopen(
        request.Request(url, json.dumps(data).encode(), headers), timeout=30
    ) as res:
        body = res.read()

    body = json.loads(body)
    out_image = body["images"][0]

    if (
        anti_glare_filter_flag != 0
        and anti_glare_filter_sigma_s != 0
        and anti_glare_filter_sigma_r != 0
    ):
        pil_image = Image.open(BytesIO(base64.b64decode(body["images"][0])))
        cv_image = np.array(pil_image, dtype=np.uint8)
        cv_image_f = cv2.edgePreservingFilter(
            cv_image,
            flags=anti_glare_filter_flag,
            sigma_s=anti_glare_filter_sigma_s,
            sigma_r=anti_glare_filter_sigma_r,
        )
        cv_mask = np.array(
            Image.open(BytesIO(base64.b64decode(mask_str.split(",")[1]))).convert("L"),
            dtype=np.uint8,
        )
        cv_mask = cv2.resize(cv_mask, (cv_image.shape[1], cv_image.shape[0]))
        _, cv_mask = cv2.threshold(cv_mask, 127, 255, cv2.THRESH_BINARY)

        # masking
        masked_image_f = cv2.bitwise_and(cv_image_f, cv_image_f, mask=cv_mask)
        masked_image = cv2.bitwise_and(
            cv_image, cv_image, mask=cv2.bitwise_not(cv_mask)
        )
        cv_image_f_masked = cv2.add(masked_image, masked_image_f)

        converted_pil_image = Image.fromarray(cv_image_f_masked)
        buffered = BytesIO()
        converted_pil_image.save(buffered, format="PNG")
        out_image = base64.b64encode(buffered.getvalue()).decode()

    if credit_consumption != 0:
        remaining_credit -= credit_consumption
        user_usage.update_user_credit(remaining_credit)

    return {
        "statusCode": 200,
        "body": json.dumps({"image": out_image, "remainingCredit": remaining_credit}),
    }
