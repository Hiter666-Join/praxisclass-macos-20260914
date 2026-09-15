# SpringAI与资料问答：14条

版本：SOFTWARE-KNOWLEDGE-1.0｜师生共用｜2026-09-14

本文件是专业讲解材料。“知识说明”依据所列来源转述；“教学用法”是本项目教学映射；“适用边界”区分来源限制、教学推断和本案例约定。来源版本不代表项目实际依赖版本。[返回使用说明](00-使用说明与条目索引.md)｜[来源登记](01-来源目录.md)

## KP-019 ChatClient发起模型调用

**知识说明：**ChatClient可通过Builder构建，以prompt组织输入，call().content()取得文本结果。

**教学用法：**把“接收接口问题”与“调用模型”画成不同职责，便于学生拆分任务。

**适用边界：**这里只解释官方API；本包没有提供或执行新的模型服务，也未锁定项目Spring AI版本。

**适用案例：**Spring＋Spring AI主案例。学习层次：原理。

**依据：**

- [A1 Spring AI — Chat Client API](https://docs.spring.io/spring-ai/reference/api/chatclient.html#_creating_a_chatclient)；Spring AI；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：Creating a ChatClient。

## KP-020 一次返回与流式返回

**知识说明：**ChatClient提供call调用与stream响应流，分别承接一次结果和逐步到达的内容。

**教学用法：**在可视化中比较完整结果出现与文字逐步出现，引导学生考虑等待体验。

**适用边界：**流式输出改变交付方式，不证明内容正确，也不自动缩短全部生成时间。

**适用案例：**Spring＋Spring AI主案例。学习层次：原理。

**依据：**

- [A1 Spring AI — Chat Client API](https://docs.spring.io/spring-ai/reference/api/chatclient.html#_streaming_responses)；Spring AI；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：Streaming Responses。

## KP-021 system与user消息的职责

**知识说明：**system消息用于引导模型行为，user消息承载用户输入。

**教学用法：**将教师设定的讲解目标和学生当前问题分开组织，避免把两类输入混写。

**适用边界：**从提示输入的性质推导：角色划分不能保证模型绝对服从，关键结论仍需证据与规则。

**适用案例：**Spring＋Spring AI主案例。学习层次：原理。

**依据：**

- [A1 Spring AI — Chat Client API](https://docs.spring.io/spring-ai/reference/api/chatclient.html#_chat_client_api)；Spring AI；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：Chat Client API：prompt与消息角色。
- [A2 Spring AI — AI Concepts](https://docs.spring.io/spring-ai/reference/concepts.html#_prompts)；Spring AI；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：Prompts。

## KP-022 Advisor扩充请求与处理响应

**知识说明：**Advisor可在模型调用前增强请求、调用后处理响应，并按链顺序参与处理。

**教学用法：**让学生标出检索资料、加入上下文和整理结果分别处于哪个环节。

**适用边界：**拥有Advisor扩展点不直接证明Agent会自主选择动作；实际选择需另有运行证据。

**适用案例：**Spring＋Spring AI主案例。学习层次：原理。

**依据：**

- [A3 Spring AI — Advisors API](https://docs.spring.io/spring-ai/reference/api/advisors.html#_core_components)；Spring AI；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：Core Components。

## KP-023 Embedding表示语义相似性

**知识说明：**Embedding把内容映射为向量，向量距离可用于估计语义接近程度。

**教学用法：**用表达不同但意思相近的两种学生提问，说明检索为何不限于字面匹配。

**适用边界：**由相似性用途推导：近邻文档可能版本或条件不合，不能直接视为事实正确。

**适用案例：**Spring＋Spring AI主案例。学习层次：原理。

**依据：**

- [A2 Spring AI — AI Concepts](https://docs.spring.io/spring-ai/reference/concepts.html#_embeddings)；Spring AI；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：Embeddings。

## KP-024 Document同时保存正文与元数据

**知识说明：**Document承载内容及metadata键值信息，为检索与来源识别提供载体。

**教学用法：**为一段产品资料保留文档名、版本、章节等信息，便于回答时追溯。

**适用边界：**框架可存metadata，但不会自动替教师确认来源真假或补齐缺失页码。

**适用案例：**Spring＋Spring AI主案例。学习层次：原理。

**依据：**

- [A4 Spring AI — Vector Databases](https://docs.spring.io/spring-ai/reference/api/vectordbs.html#_vectorstore)；Spring AI；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：VectorStore：Document与metadata。

## KP-025 topK限制返回数量

**知识说明：**相似检索的topK指定最多返回的近邻数量。

**教学用法：**要求学生解释“返回更多片段”会增加哪些阅读和筛选工作。

**适用边界：**数量是上限；结果可能不足topK，也可能相关但不能支持当前结论。

**适用案例：**Spring＋Spring AI主案例。学习层次：原理。

**依据：**

- [A4 Spring AI — Vector Databases](https://docs.spring.io/spring-ai/reference/api/vectordbs.html#_searchrequest_builder)；Spring AI；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：SearchRequest Builder：topK。

## KP-026 相似度阈值筛选候选内容

**知识说明：**similarityThreshold按相似度门槛筛选检索候选。

**教学用法：**让学生区分检索得分、证据适用性和最终答案判断三个层次。

**适用边界：**按API用途推导：阈值不是答案正确率、事实概率或工业视觉分数；具体度量需看所用后端。

**适用案例：**Spring＋Spring AI主案例。学习层次：原理。

**依据：**

- [A4 Spring AI — Vector Databases](https://docs.spring.io/spring-ai/reference/api/vectordbs.html#_searchrequest_builder)；Spring AI；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：SearchRequest Builder：similarityThreshold。

## KP-027 metadata过滤限定资料范围

**知识说明：**metadata filter按文档属性限制检索集合，例如版本或分组。

**教学用法：**先按题目产品版本筛选，再判断片段是否解释了所问功能。

**适用边界：**过滤能力和配置依赖后端；由用途推导，文档筛选不能单独替代身份校验与权限控制。

**适用案例：**Spring＋Spring AI主案例。学习层次：原理。

**依据：**

- [A4 Spring AI — Vector Databases](https://docs.spring.io/spring-ai/reference/api/vectordbs.html#_metadata_filters)；Spring AI；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：Metadata Filters。

## KP-028 文档切分保留来源关联

**知识说明：**TextSplitter将文档拆为片段，并把原文metadata复制到片段。

**教学用法：**检查切分后限制条件是否仍与操作步骤一起可见，并保留来源章节。

**适用边界：**复制metadata不保证语义完整；把例外条件切掉，仍可能导致错误引用。

**适用案例：**Spring＋Spring AI主案例。学习层次：原理。

**依据：**

- [A5 Spring AI — ETL Pipeline](https://docs.spring.io/spring-ai/reference/api/etl-pipeline.html#_text_splitter)；Spring AI；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：Text Splitter。

## KP-029 QuestionAnswerAdvisor的基础RAG

**知识说明：**QuestionAnswerAdvisor检索相似文档，并把所得内容加入模型输入。

**教学用法：**让学生连接“问题→检索→资料进入上下文→回答”，理解资料问答的最短机制。

**适用边界：**检索后仍要核查版本与证据；调用该组件不等于模型只会按资料回答。

**适用案例：**Spring＋Spring AI主案例。学习层次：原理。

**依据：**

- [A6 Spring AI — Retrieval Augmented Generation](https://docs.spring.io/spring-ai/reference/api/retrieval-augmented-generation.html#_questionansweradvisor)；Spring AI；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：QuestionAnswerAdvisor。

## KP-030 模块化RAG的职责拆分

**知识说明：**RetrievalAugmentationAdvisor可组合查询处理、检索和上下文增强等模块。

**教学用法：**把复杂资料问答拆成可说明的职责，帮助学生提出处理方案。

**适用边界：**本条是拆解思路，不要求首版实现全部模块或新建一条复杂工作流。

**适用案例：**Spring＋Spring AI主案例。学习层次：拓展。

**依据：**

- [A6 Spring AI — Retrieval Augmented Generation](https://docs.spring.io/spring-ai/reference/api/retrieval-augmented-generation.html#_retrievalaugmentationadvisor)；Spring AI；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：RetrievalAugmentationAdvisor；Modules。

## KP-031 没有检索证据时的处理策略

**知识说明：**ContextualQueryAugmenter默认对空上下文采用不作答提示，也可显式允许空上下文。

**教学用法：**让学生先识别缺版本、资料缺项或检索无结果，再选择澄清或说明不足。

**适用边界：**这是框架提示策略，不是硬性正确性保证；本题的澄清与不足状态仍按案例契约判定。

**适用案例：**Spring＋Spring AI主案例。学习层次：原理。

**依据：**

- [A6 Spring AI — Retrieval Augmented Generation](https://docs.spring.io/spring-ai/reference/api/retrieval-augmented-generation.html#_contextual_query_augmenter)；Spring AI；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：Contextual Query Augmenter；Empty context。

## KP-032 对话记忆与知识资料分工

**知识说明：**ChatMemory组织会话历史；知识检索组织文档内容，两者用途不同。

**教学用法：**区分“学生刚才问过什么”和“技术资料规定什么”，避免用聊天记录替代依据。

**适用边界：**应用需保证身份、会话及读取范围一致；有conversation ID不代表框架已完成师生权限隔离。

**适用案例：**Spring＋Spring AI主案例。学习层次：原理。

**依据：**

- [A7 Spring AI — Chat Memory](https://docs.spring.io/spring-ai/reference/api/chat-memory.html#_memory_in_chat_client)；Spring AI；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：Memory in Chat Client。
- [A4 Spring AI — Vector Databases](https://docs.spring.io/spring-ai/reference/api/vectordbs.html#_vectorstore)；Spring AI；滚动官方文档；2026-09-14核对，非项目依赖版本；定位：VectorStore：Document。
