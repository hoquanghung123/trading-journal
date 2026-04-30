import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PlaybookModel } from "@/types/playbook";
import { fetchPlaybook, upsertSetup, deleteSetup, playbookQueryKey } from "@/lib/playbook";
import { toast } from "sonner";

export function usePlaybook() {
  const queryClient = useQueryClient();

  const { data: models = [], isLoading: isLoaded } = useQuery({
    queryKey: playbookQueryKey,
    queryFn: fetchPlaybook,
  });

  const addMutation = useMutation({
    mutationFn: (model: PlaybookModel) => upsertSetup(model),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playbookQueryKey });
      toast.success("Strategy created");
    },
    onError: (e: any) => {
      toast.error(e.message || "Failed to add strategy");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (updatedModel: PlaybookModel) => upsertSetup(updatedModel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playbookQueryKey });
      toast.success("Strategy updated");
    },
    onError: (e: any) => {
      toast.error(e.message || "Failed to update strategy");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSetup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playbookQueryKey });
      toast.success("Strategy deleted");
    },
    onError: (e: any) => {
      toast.error(e.message || "Failed to delete strategy");
    },
  });

  return {
    models,
    isLoaded: !isLoaded, // Maintain legacy naming for compatibility
    addModel: addMutation.mutateAsync,
    updateModel: updateMutation.mutateAsync,
    deleteModel: deleteMutation.mutateAsync,
  };
}
