import React from "react";
import { Pressable, ActivityIndicator } from "react-native";
import { Text } from "./Themed";
import { lightTheme } from "../theme/theme";

type Props = { title: string; onPress?: () => void; loading?: boolean; variant?: "primary"|"outline"|"ghost"; disabled?: boolean; };
export default function Button({ title, onPress, loading, variant="primary", disabled }: Props){
  const base = {
    paddingVertical: 14,
    borderRadius: lightTheme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: variant==="outline" ? 1 : 0,
    borderColor: lightTheme.colors.primary
  } as const;
  const bg = variant==="primary" ? { backgroundColor: disabled ? "#ccc" : lightTheme.colors.primary } :
             variant==="outline" ? { backgroundColor: "transparent" } : { backgroundColor: "transparent" };
  const color = variant==="primary" ? "#fff" : lightTheme.colors.primary;

  return (
    <Pressable onPress={onPress} disabled={disabled||loading} style={[base, bg]}>
      {loading ? <ActivityIndicator color={variant==="primary" ? "#fff" : lightTheme.colors.primary}/> :
        <Text style={{ color, fontWeight: "600" }}>{title}</Text>}
    </Pressable>
  );
}
