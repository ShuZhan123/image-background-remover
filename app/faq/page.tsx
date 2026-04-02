import Link from "next/link";

const faqs = [
  {
    question: "这个工具真的免费吗？",
    answer:
      "是的！每个未登录用户每天可以免费使用3次，注册登录后每月免费15次，完全满足偶尔使用的需求。如果您需要更多次数，可以开通Pro套餐。",
  },
  {
    question: "我的图片会被存储吗？隐私安全吗？",
    answer:
      "我们尊重您的隐私。图片仅在处理过程中于内存中流转，处理完成后立即释放，不会存储在我们的服务器上。登录用户会保留处理历史记录，但仅您本人可见，不会对外公开。",
  },
  {
    question: "支持哪些图片格式？最大文件多大？",
    answer:
      "支持 JPG、PNG、WebP 格式。免费用户和未登录用户最大支持 10MB，Pro 用户最大支持 25MB。",
  },
  {
    question: "下载的图片是什么格式？背景透明吗？",
    answer:
      "下载结果是PNG格式，保留透明背景，可以直接用于电商主图、设计素材、海报制作等场景。",
  },
  {
    question: "没用完的次数会累积到下个月吗？",
    answer:
      "月付套餐的次数是当月有效，月底清零不累积。年付套餐是给你总共2400次，有效期一年，你可以自由分配使用，不用担心过期。",
  },
  {
    question: "可以退款吗？",
    answer:
      "如果您购买后发现无法正常使用，可以联系我们在7天内全额退款。如果是正常使用了一部分次数，不支持按比例退款哦。",
  },
  {
    question: "可以使用我自己的 Remove.bg API Key 吗？",
    answer:
      "Pro 用户支持绑定自己的 Remove.bg API Key，这样处理次数按您自己的 API Key 额度计算，不会消耗我们给你的套餐次数。",
  },
  {
    question: "什么是批量处理？一次能处理多少张？",
    answer:
      "Pro 用户支持批量上传，一次最多上传10张图片，自动批量处理后打包下载，节省您的时间，提高效率。",
  },
  {
    question: "支持自定义背景颜色或图片吗？",
    answer:
      "目前这个功能还在开发中，敬请期待。当前版本只提供背景去除下载透明PNG。",
  },
  {
    question: "未登录用户和登录用户有什么区别？",
    answer:
      "未登录用户每天3次，按IP限制。登录用户每月15次，按账号限制，可以查看处理历史记录。开通Pro后获得更多次数和高级功能。",
  },
  {
    question: "订阅可以随时取消吗？",
    answer:
      "可以，你随时可以在个人中心取消自动续费（如果是自动续费订阅），取消后已购买的次数可以用到有效期结束。",
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">常见问题</h1>
          <p className="text-gray-600">
            这里回答了大部分用户常见问题，如果还有疑问，请联系我们
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`p-6 ${
                index !== faqs.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              <h3 className="font-semibold text-lg text-gray-900 mb-2">
                Q: {faq.question}
              </h3>
              <p className="text-gray-600 leading-relaxed">A: {faq.answer}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/pricing"
            className="inline-block px-8 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            查看定价 →
          </Link>
        </div>
      </div>
    </div>
  );
}
