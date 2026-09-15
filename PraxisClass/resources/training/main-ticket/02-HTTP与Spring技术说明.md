# 从页面问题到后端对象：HTTP与Spring

材料编号：TECH-HTTP｜版本：1.0｜核对日期：2026-09-13  
用途：师生共用。本文为AI辅助编制的教学转述；技术机制与本案例约定分别标明。

## 先理解一次往返

用户在页面输入问题，页面按约定构造请求。服务器接收请求并处理，再发出响应。页面读取响应，向用户呈现结果。

“页面输入框”“请求体”“后端对象”是不同位置。观察同一段问题文字在这些位置怎样对应，比先记住大量网络名词更有帮助。本节聚焦HTTP请求与响应，不展开TCP或TLS握手。

## HTTP提供什么约定

- HTTP消息包含控制信息、头字段以及可能携带的内容等部分；请求和响应具有不同作用。
- Content-Type说明消息内容的媒体类型。
- POST将所携带的表示交给目标资源按其语义处理。
- 200表达请求成功；400用于服务器感知到客户端错误的情形；503表达临时无法服务。状态码本身不定义工单产品的功能。

来源：[RFC 9110 §6](https://www.rfc-editor.org/rfc/rfc9110.html#section-6)、[§8.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3)、[§9.3.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.3)、[§15.3.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.1)、[§15.5.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.1)、[§15.6.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.6.4)。

## Spring在其中做什么

Spring MVC可以通过@RequestBody和HttpMessageConverter，把请求体读取并转换为Java对象。它可以与Bean Validation配合，但字段约束必须定义；默认验证错误可转为400，项目也可设置错误处理。

来源：[Spring Framework：@RequestBody](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-methods/requestbody.html)。

本次只学习机制，不提供未经运行核验的Java项目。不要仅凭一个注解就推断“产品版本已核对”“角色已鉴权”或“资料已经充分”。

## 放回本案例

以下是[接口约定](05-接口约定.md)定义的教学对应：

| 观察位置 | 本案例要看到的内容 |
|---|---|
| 页面 | 用户输入的问题文字 |
| 请求 | POST /api/product-qa；JSON中的productId、productVersion、question |
| 后端接收 | question对应接收对象中的问题字段；另有产品及版本条件 |
| 后端处理 | 核对条件，读取资料，判断适用性及支撑关系 |
| 响应 | 200时读取status、answer、sources；400或503时读取error |
| 页面展示 | 显示回答、来源、待补条件或错误说明 |

业务status属于本案例约定。即使HTTP请求已处理，也可能需要补充业务条件，或需要说明资料不足。还应区分“没有读到所需资料”与“读过指定资料仍不能确认”。

## 学习时可以这样自查

请指着当前请求，找到真正承载问题的字段；再指着响应，找到页面需要显示的内容。如果把answer放进请求来替代question，或看到200就断言产品具备某功能，回到接口契约核对数据方向和依据。

验证题见[学生任务](08-学生验证任务.md)。本说明提供学习依据，不替你填写本次提交。
