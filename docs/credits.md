# 用户积分
用户需要积分来进行图片生成等任务，每执行一次生成任务消耗1积分。
支持用户购买积分。

## 应用内积分产品ID对应的积分数量
```
PRODUCT_CREDITS_MAP = {
    "credits10": 10,
    "credits100": 100,
    "credits200": 200,
}
```
credits10 增加10 积分，credits100 增加100积分

## 购买积分
通过App进行应用内支付，购买积分后，请求服务器进行数据校验，校验通过后更新用户积分余额。

App 提交的请求参数（`platform` 支持 `ios`、`android`、`macos`）：
```json
{
  "platform": "ios",
  "purchase_id": "2000001042385979",
  "product_id": "credits10",
  "verification_data": "eyJhbGciOiJFUzI1NiIs..."
}
```

## 购买接口

`POST /api/credits/purchase`

- Header: `Authorization: Bearer <access token>`
- Body: 与上方示例一致

服务器会：

1. 校验参数合法性（平台、产品、校验串等）
2. 根据平台解析 `verification_data`：iOS/macos 使用官方 `@apple/app-store-server-library` 校验签名的交易数据（需要将 Apple 根证书 `.cer` 文件放到 `src/apple_certs/` 供服务端加载），Android 解析 Google Play 返回的 JSON，确保其中的 `product_id`、订单号等信息与本次请求一致
3. 校验通过后，根据产品 ID 映射的积分数量为当前用户增加积分

成功返回：

```json
{
  "creditsAdded": 10,
  "balance": 120
}
```

客户端可根据返回的余额刷新界面。
