# SDサーバインストール記録

バックエンドはSD-WebuiをAPIとして使う。必要な手入れ箇所を本手順所の中で述べる。
基本的にこのページの手法に従っている。<https://cuebic.co.jp/tech-blog/entry/ec2-stable-diffusion>

## インストール

AMIはAmazon Linux 2, DeepLearning pytorch 1.3.1を選択。

```sh
sudo yum remove openssl openssl-devel
sudo yum -y install bzip2 bzip2-devel gcc git libffi-devel make openssl11 openssl11-devel readline readline-devel sqlite sqlite-devel zlib-devel xz-devel

# install pyenv
git clone https://github.com/pyenv/pyenv.git ~/.pyenv
```

vimなどで`~/.bashrc`に以下を追加

```
export PATH="$HOME/.pyenv/bin:$PATH"
eval "$(pyenv init -)"
```

`source .bashrc`を打つか一旦ログインし直して以下を続ける。

```sh
# install python
pyenv install 3.10.6 # take long time
pyenv global 3.10.6
python -V # should be Python 3.10.6

# install WebbUI
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git
cd stable-diffusion-webui
```

vimで`webui-user.sh`編集する。`COMMANDLINE_ARGS`を以下にする。

```
export COMMANDLINE_ARGS="--xformers --share --enable-insecure-extension-access"
```

モデルをダウンロード

```sh
cd models/Stable-diffusion/
# 好みのモデルをダウンロード
curl -L "https://url/of/model" -o model.safetensors
```

一旦起動する。

```sh
cd ~/stable-diffusion-webui
./webui.sh
```

表示されるGradioのリンクからブラウザでWebUIを開く。
Extentionメニューから以下をインストールする。インストールしてApplyしたら一旦閉じてOK。

- Tagger
- Controlnet

次にControlnet用のモデルをインストールする。

```sh
cd ~/stable-diffusion-webui
cd extensions/sd-webui-controlnet/models/
curl -L "https://huggingface.co/lllyasviel/ControlNet-v1-1/resolve/main/control_v11p_sd15_lineart.pth?download=true" -o control_v11p_sd15_lineart.pth

# 以下optional
curl -L "https://huggingface.co/lllyasviel/ControlNet-v1-1/resolve/main/control_v11p_sd15_canny.pth?download=true" -o control_v11p_sd15_canny.pth
curl -L "https://huggingface.co/lllyasviel/sd_control_collection/resolve/main/ioclab_sd15_recolor.safetensors?download=true" -o ioclab_sd15_recolor.safetensors
curl -L "https://huggingface.co/lllyasviel/ControlNet-v1-1/resolve/main/control_v11p_sd15_openpose.pth?download=true" -o control_v11p_sd15_openpose.pth
```

(オプショナル)いくつかのEmbedding/Textual Inversionをインストールする

```sh
cd ~/stable-diffusion-webui
cd embeddings/

# 好みに応じて
curl -L "https://civitai.com/api/download/models/5637?type=Model&format=PickleTensor&size=full&fp=fp16" -o ng_deepnegative_v1_75t.pt
curl -L "https://civitai.com/api/download/models/125849" -o bad-hands-5.pt
```

## SDサーバの修正箇所

エッジ検出のために手入れした箇所をまとめておく。出荷状態のControlnetはプリプロセッサとモデルが一体となっており、検出したエッジをユーザが好きに加工することができないため、処理を分離する変更をしている。

stable-diffusion-webui/modules/cmd_args.pyの最後に追加

```python
parser.add_argument("--myapp", action='store_true', help="act as my app's backend API")
```

stable-diffusion-webui/extensions/sd-webui-controlnet/scripts/global_state.py
コメントアウトして`replace_by_identity()`に変えている行が編集したところ。

```python
def replace_by_identity(module):
    return identity if cmd_opts.myapp else module

cn_preprocessor_modules = {
    "none": lambda x, *args, **kwargs: (x, True),
    # "canny": canny,
    "canny": replace_by_identity(canny),
    "depth": midas,
    "depth_leres": functools.partial(leres, boost=False),
    "depth_leres++": functools.partial(leres, boost=True),
    "hed": hed,
    "hed_safe": hed_safe,
    "mediapipe_face": mediapipe_face,
    "mlsd": mlsd,
    "normal_map": midas_normal,
    "openpose": functools.partial(g_openpose_model.run_model, include_body=True, include_hand=False, include_face=False),
    "openpose_hand": functools.partial(g_openpose_model.run_model, include_body=True, include_hand=True, include_face=False),
    "openpose_face": functools.partial(g_openpose_model.run_model, include_body=True, include_hand=False, include_face=True),
    "openpose_faceonly": functools.partial(g_openpose_model.run_model, include_body=False, include_hand=False, include_face=True),
    "openpose_full": functools.partial(g_openpose_model.run_model, include_body=True, include_hand=True, include_face=True),
    "dw_openpose_full": functools.partial(g_openpose_model.run_model, include_body=True, include_hand=True, include_face=True, use_dw_pose=True),
    "clip_vision": functools.partial(clip, config='clip_vitl'),
    "revision_clipvision": functools.partial(clip, config='clip_g'),
    "revision_ignore_prompt": functools.partial(clip, config='clip_g'),
    "ip-adapter_clip_sd15": functools.partial(clip, config='clip_h'),
    "ip-adapter_clip_sdxl_plus_vith": functools.partial(clip, config='clip_h'),
    "ip-adapter_clip_sdxl": functools.partial(clip, config='clip_g'),
    "color": color,
    "pidinet": pidinet,
    "pidinet_safe": pidinet_safe,
    "pidinet_sketch": pidinet_ts,
    "pidinet_scribble": scribble_pidinet,
    "scribble_xdog": scribble_xdog,
    "scribble_hed": scribble_hed,
    "segmentation": uniformer,
    "threshold": threshold,
    "depth_zoe": zoe_depth,
    "normal_bae": normal_bae,
    "oneformer_coco": oneformer_coco,
    "oneformer_ade20k": oneformer_ade20k,
    # "lineart": lineart,
    "lineart": replace_by_identity(lineart),
    # "lineart_coarse": lineart_coarse,
    "lineart_coarse": replace_by_identity(lineart),
    "lineart_anime": lineart_anime,
    # "lineart_standard": lineart_standard,
    "lineart_standard": replace_by_identity(lineart),
    "shuffle": shuffle,
    "tile_resample": tile_resample,
    "invert": invert,
    "lineart_anime_denoise": lineart_anime_denoise,
    "reference_only": identity,
    "reference_adain": identity,
    "reference_adain+attn": identity,
    "inpaint": identity,
    "inpaint_only": identity,
    "inpaint_only+lama": lama_inpaint,
    "tile_colorfix": identity,
    "tile_colorfix+sharp": identity,
    "recolor_luminance": recolor_luminance,
    "recolor_intensity": recolor_intensity,
    "blur_gaussian": blur_gaussian,
    "anime_face_segment": anime_face_segment,
}
```

stable-diffusion-webui/extensions/sd-webui-controlnet/scripts/api.py

```python
from scripts.processor import canny, preprocessor_filters, lineart, lineart_coarse, lineart_standard

@app.post("/controlnet/detect-only")
    async def detect_only(
        controlnet_module: str = Body("none", title='Controlnet Module'),
        controlnet_input_images: List[str] = Body([], title='Controlnet Input Images'),
        controlnet_processor_res: int = Body(512, title='Controlnet Processor Resolution'),
        controlnet_threshold_a: float = Body(64, title='Controlnet Threshold a'),
        controlnet_threshold_b: float = Body(64, title='Controlnet Threshold b')
    ):
        if controlnet_module == "canny":
            processor_module = canny
        elif controlnet_module == "hed":
            processor_module = hed
        elif controlnet_module == "lineart":
            processor_module = lineart
        elif controlnet_module == "lineart_standard":
            processor_module = lineart_standard
        elif controlnet_module == "lineart_coarse":
            processor_module = lineart_coarse
        else:
            raise NotImplementedError

        results = []
        for input_image in controlnet_input_images:
            img = external_code.to_base64_nparray(input_image)
            results.append(processor_module(img, res=controlnet_processor_res, thr_a=controlnet_threshold_a, thr_b=controlnet_threshold_b)[0])

        results64 = list(map(encode_to_base64, results))
        return {"images": results64, "info": "Success"}
```

API-onlyモードではLoraが読み込まれないバグがあるので修正する。webui.pyの一部を以下のように編集。
詳細情報 <https://github.com/AUTOMATIC1111/stable-diffusion-webui/issues/7984>

```python
def api_only():
    initialize()

    app = FastAPI()
    setup_middleware(app)
    api = create_api(app)

    modules.script_callbacks.before_ui_callback()  # 追加
    modules.script_callbacks.app_started_callback(None, app)

    print(f"Startup time: {startup_timer.summary()}.")
    api.launch(server_name="0.0.0.0" if cmd_opts.listen else "127.0.0.1", port=cmd_opts.port if cmd_opts.port else 7861)
```

## 自動起動設定

rootで作業する。サービス設定ファイルを作る。

```sh
sudo -s
touch /etc/systemd/system/myapp.service
vim /etc/systemd/system/myapp.service
```

サービスの設定ファイルは以下の通り

```
[Unit]
Description=Run myapp
After=network.target

[Service]
WorkingDirectory=/home/ec2-user/stable-diffusion-webui
ExecStart=/bin/bash -c 'source /home/ec2-user/.bashrc; ./webui.sh --nowebui --listen --myapp'
User=ec2-user
Group=ec2-user

[Install]
WantedBy=multi-user.target
```

サービス登録

```sh
systemctl enable myapp.service
```
