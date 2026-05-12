import { z } from "zod";

export const assetFormSchema = z
  .object({
    name: z.string().trim().min(1, "请输入物品名称"),
    category: z.string().trim().min(1, "请选择分类"),
    price: z.number().min(0, "购入价格不能小于 0"),
    buyTime: z.string().min(1, "请选择购买日期"),
    deactivatedAt: z.string().optional().nullable(),
    addFee: z.number().default(0),
    status: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    sellPrice: z.number().default(0),
    useCount: z.number().int().min(0).default(0),
  })
  .superRefine((value, ctx) => {
    const buyDate = new Date(value.buyTime);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (Number.isNaN(buyDate.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["buyTime"],
        message: "购买日期格式不正确",
      });
    } else if (buyDate.getTime() > todayStart.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["buyTime"],
        message: "购买日期不能晚于今天",
      });
    }

    if (value.price + value.addFee < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["addFee"],
        message: "费用合计不能为负",
      });
    }

    if (value.status === 2 && value.sellPrice < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sellPrice"],
        message: "卖出残值不能小于 0",
      });
    }

    if (value.status === 1) {
      if (!value.deactivatedAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["deactivatedAt"],
          message: "请选择停用日期",
        });
      } else {
        const deactivatedDate = new Date(value.deactivatedAt);
        if (Number.isNaN(deactivatedDate.getTime())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["deactivatedAt"],
            message: "停用日期格式不正确",
          });
        } else if (deactivatedDate.getTime() > todayStart.getTime()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["deactivatedAt"],
            message: "停用日期不能晚于今天",
          });
        } else if (deactivatedDate.getTime() < buyDate.getTime()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["deactivatedAt"],
            message: "停用日期不能早于购买日期",
          });
        }
      }
    }
  });

export type AssetFormData = z.infer<typeof assetFormSchema>;
