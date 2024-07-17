# インスタンスID
INSTANCE_ID="i-xxxx"

# インスタンスの現在のパブリックIPアドレスを取得
NEW_IP=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --query 'Reservations[*].Instances[*].PublicIpAddress' --output text)

echo $NEW_IP

# configを書き換える
cp ~/.ssh/config ~/.ssh/config.bak

sed -i '' "/^Host sd-service$/{n;s/HostName .*/HostName ${NEW_IP}/;}" ~/.ssh/config

