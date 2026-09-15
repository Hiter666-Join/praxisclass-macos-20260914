# 案例 A：有序数据检索实训

这是可运行的内容草案，不包含真实教师或学生试用结果。团队可用作演示起点，最终课程素材与测量版本仍需定稿。

- 任务：实现 `solution(nums, target)`，对升序整数列表返回目标首次出现的下标，不存在则返回 -1。
- 固定测试集：`binary-search.html` 的 `frozen-cases`，编号 **A-20260905-01**，共 12 例（2 公开、10 隐藏）。两轮比较前由团队确认并冻结；一旦改用例，应另起测试集编号。
- 判分：仅检验返回值，要求为整数且与期望值一致。复杂度与代码可读性由教师评价，不能以正确率代替。
- 支持：L0 自主分析、L1/L2 逐层提示、公开示例的二分区间演示、运行错误与 8 秒超时反馈。
- 运行：Pyodide 0.29.2 在 Web Worker 中执行，无服务端代码执行；首次需连接 jsDelivr。环境下载失败不产生“未通过”记录。
- 数据：只有显式提交后才发送 `praxis:code-test-results`；宿主检查 iframe 来源，并提供课堂和匿名学习者身份。独立打开 HTML 不上传结果。
- 隐藏用例仅在界面隐藏，适合教学，不能用于防作弊考试。

生成可导入课件：

```powershell
node scripts/build-case-a-demo.mjs <输出目录>
```

在备课首页使用“导入课堂”导入 `.praxis.zip`，从学生端进入课程后提交练习，再打开学习看板核对 `case_a_algo`。v1/v2 真实测量必须使用同一套用例；不提供预制改进率，不用本样例的调试数据代替真人数据。

知识与运行参考：[Python bisect](https://docs.python.org/3/library/bisect.html)、[Pyodide 0.29.2 使用说明](https://pyodide.org/en/0.29.2/usage/index.html)。
