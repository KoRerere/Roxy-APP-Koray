import { useToast } from "primevue/usetoast";
import { I18nT } from "vue-i18n";
import { API } from "/@/api";
import { useFormDialog } from "/@/hooks/useFormDialog";
import { useResponseToast } from "/@/hooks/useResponseToast";
import { $t } from "/@/locales";
import { isLikeFunction } from "/@/utils";
import { projectFormSchemas } from "/@/views/projects/schemas";
import { useHandleBusinessCode } from "/@/hooks/useResponseToast/handleBusinessCode";

interface TagActionsOptions {
  toast?: boolean;
}

const defaultOptions: TagActionsOptions = {
  toast: true,
};

export function useProjectActions(options: TagActionsOptions = defaultOptions) {
  const [showFormDialog] = useFormDialog();
  const [showToast] = useResponseToast();
  const toast = useToast();
  const router = useRouter();
  const { handleBusinessCode } = useHandleBusinessCode()

  async function addDialog(props?: any) {
    const { confirmNext, ...data } = props || {};

    const formDialogInstance = await showFormDialog({
      header: data.project_id ? $t("编辑项目") : $t("创建项目"),
      class: "w-[500px]",
      schemas: projectFormSchemas,
      formProps: {
        layout: "vertical",
      },
      handleOk: async (params: any) => {
        const res = data.project_id
          ? await API.limit.userMdfProjectInfoCreate({ id: data.project_id, ...params })
          : await API.limit.userAddProjectInfoCreate(params);

        if (res.code === 0) {
          isLikeFunction(confirmNext) && (await confirmNext({ params, res }));
        }

        handleBusinessCode(res.code, () => {
          if (options.toast || res.code !== 0) {
            showToast(res.code, res.msg);
            // TODO
          }
        })
      },
    });

    formDialogInstance.formRef.value?.setFieldsValue({
      id: data.project_id,
      ...data,
    });
  }

  return [addDialog];
}
