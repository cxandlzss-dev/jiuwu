# 酒屋大战网页版

这是《酒屋大战》的网页试玩版，适合先发到 GitHub 预览和继续迭代，再决定是否同步回微信小程序。

## 仓库建议

如果你要直接上传 GitHub，推荐把整个 `jiuwu-battle-web` 文件夹作为一个独立仓库。

仓库名可以用：

- `jiuwu-battle-web`
- `jiuwu-dazhan`
- `izakaya-battle-web`

## 项目内容

- 角色选择：`钟局`、`兵王`、`月月鸟哥`
- 回合制喝酒战斗
- 每回合随机抽取 3 张技能卡
- 角色一次性绝活
- `酒醉度` 满 100 判负
- 日式居酒屋搞笑风格 UI
- 背景音乐开关
- 出牌、绝活、胜负音效
- 网页图标 `favicon`

## 本地打开

### 方式 1

直接双击 `index.html`

### 方式 2

双击 `start-server.bat`，然后打开：

- `http://127.0.0.1:8765/`

## 上传 GitHub

1. 新建一个 GitHub 仓库
2. 把当前目录 `jiuwu-battle-web` 里的所有文件上传上去
3. 如果你之后要接入 GitHub Pages，建议把仓库内容直接放在仓库根目录

## 目录

```text
jiuwu-battle-web/
├─ assets/
│  └─ icon-jiuwu-dazhan.png
├─ .gitignore
├─ app.js
├─ index.html
├─ README.md
├─ server.ps1
├─ start-server.bat
└─ styles.css
```

## 关键文件

- `index.html`：页面入口
- `styles.css`：视觉样式
- `app.js`：战斗逻辑、角色、卡牌、音乐和音效
- `assets/icon-jiuwu-dazhan.png`：网页图标

## 备注

这个版本是纯静态前端，不依赖 Node、npm 或打包器，直接上传 GitHub 也没问题。
