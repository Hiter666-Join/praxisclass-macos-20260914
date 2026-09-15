# Spring接口应用：8条

版本：SOFTWARE-KNOWLEDGE-1.0｜师生共用｜2026-09-14

本文件是专业讲解材料。“知识说明”依据所列来源转述；“教学用法”是本项目教学映射；“适用边界”区分来源限制、教学推断和本案例约定。来源版本不代表项目实际依赖版本。[返回使用说明](00-使用说明与条目索引.md)｜[来源登记](01-来源目录.md)

## KP-011 按路径和HTTP方法映射处理器

**知识说明：**Spring MVC可按路径、HTTP方法等匹配处理器；GetMapping和PostMapping是常用快捷注解。

**教学用法：**把已给定的接口契约映射到控制器入口，说明路径相同但方法不同为何会走不同处理。

**适用边界：**注解选择应服从契约；路径匹配策略依赖具体Spring版本及配置。

**适用案例：**Spring＋Spring AI主案例。学习层次：基础。

**依据：**

- [S1 Spring MVC — Mapping Requests](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-requestmapping.html)；Spring；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：@RequestMapping；URI patterns。

## KP-012 PathVariable绑定路径变量

**知识说明：**PathVariable从URI模板中读取路径变量，并可转换为声明类型。

**教学用法：**比较/users/{id}中的id与问号后的查询参数，画出传入位置。

**适用边界：**它不负责读取query或JSON正文。此例是通用讲解，未给主案例新增接口。

**适用案例：**Spring＋Spring AI主案例。学习层次：基础。

**依据：**

- [S2 Spring MVC — Method Arguments](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-methods/arguments.html)；Spring；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：Method Arguments表：@PathVariable。

## KP-013 RequestParam绑定请求参数

**知识说明：**RequestParam可读取查询、表单等Servlet请求参数，并进行类型转换。

**教学用法：**先判断输入来自地址查询还是表单，再选择参数绑定方式。

**适用边界：**不要概括为只读取query，也不要用它直接代替JSON对象反序列化。

**适用案例：**Spring＋Spring AI主案例。学习层次：基础。

**依据：**

- [S2 Spring MVC — Method Arguments](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-methods/arguments.html)；Spring；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：Method Arguments表：@RequestParam。

## KP-014 RequestBody与消息转换器

**知识说明：**RequestBody通过HttpMessageConverter把请求体转换为目标参数对象。

**教学用法：**让学生连接JSON正文、Java入参和后续处理三个节点。

**适用边界：**可接受格式受转换器、依赖与媒体类型约束；表单参数通常另用RequestParam。

**适用案例：**Spring＋Spring AI主案例。学习层次：基础。

**依据：**

- [S3 Spring MVC — @RequestBody](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-methods/requestbody.html)；Spring；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：@RequestBody正文及表单说明。

## KP-015 请求对象的约束验证

**知识说明：**Valid可配合RequestBody触发Bean Validation；常见的请求体验证失败默认返回400。

**教学用法：**依据题目契约列出必填、非空等要求，再说明输入何时应被拒绝。

**适用边界：**Valid自身不是非空约束；错误类型及映射会受方法约束和异常处理配置影响。

**适用案例：**Spring＋Spring AI主案例。学习层次：基础。

**依据：**

- [S3 Spring MVC — @RequestBody](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-methods/requestbody.html)；Spring；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：@Valid / @Validated及MethodArgumentNotValidException。
- [S4 Spring MVC — Validation](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-validation.html)；Spring；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：Validation；方法验证与HandlerMethodValidationException。

## KP-016 ResponseBody输出响应内容

**知识说明：**ResponseBody经消息转换器写出返回值；RestController组合了Controller与类级ResponseBody语义。

**教学用法：**追踪Java返回对象如何成为前端可读取的响应体。

**适用边界：**不自动保证返回JSON；格式仍取决于内容协商及可用转换器。

**适用案例：**Spring＋Spring AI主案例。学习层次：基础。

**依据：**

- [S5 Spring MVC — @ResponseBody](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-methods/responsebody.html)；Spring；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：@ResponseBody；@RestController。

## KP-017 ResponseEntity同时表达状态、头和正文

**知识说明：**ResponseEntity允许一起指定HTTP状态、响应头和响应体。

**教学用法：**把主案例协议状态与JSON业务内容分别放入对应位置。

**适用边界：**它不是自动统一错误格式的功能，也不替应用判断该返回哪种业务结果。

**适用案例：**Spring＋Spring AI主案例。学习层次：基础。

**依据：**

- [S6 Spring MVC — ResponseEntity](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-methods/responseentity.html)；Spring；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：ResponseEntity。

## KP-018 用ExceptionHandler集中解释异常

**知识说明：**ExceptionHandler可在控制器或ControllerAdvice中处理异常并形成响应。

**教学用法：**将“输入问题、服务问题、知识不足”分开，讨论哪些属于异常处理责任。

**适用边界：**具体状态与错误体需由应用定义；不能把所有异常都统一说成503。

**适用案例：**Spring＋Spring AI主案例。学习层次：基础。

**依据：**

- [S7 Spring MVC — Exceptions / @ExceptionHandler](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-exceptionhandler.html)；Spring；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：Exceptions；@ExceptionHandler；Return Values。
