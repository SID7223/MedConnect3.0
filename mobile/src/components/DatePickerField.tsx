import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../context/Theme';

// Date field that opens the native picker dialog (port of web <input type="date">).
// value: 'YYYY-MM-DD' or '' when unset.
export default function DatePickerField({
  value,
  onPick,
  placeholder = 'YYYY-MM-DD',
}: {
  value: string;
  onPick: (yyyyMmDd: string) => void;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const [show, setShow] = useState(false);

  const date = value ? new Date(value + 'T00:00:00') : new Date();

  const onChange = (event: unknown, picked?: Date) => {
    setShow(false);
    if (event && typeof event === 'object' && 'type' in event && (event as { type: string }).type === 'set' && picked) {
      const mm = String(picked.getMonth() + 1).padStart(2, '0');
      const dd = String(picked.getDate()).padStart(2, '0');
      onPick(`${picked.getFullYear()}-${mm}-${dd}`);
    }
  };

  return (
    <View>
      <Pressable
        onPress={() => setShow(true)}
        style={[
          styles.field,
          { backgroundColor: colors.paper, borderColor: colors.line },
        ]}
      >
        <Text style={{ color: value ? colors.ink : colors.subtle, fontSize: 14 }}>
          {value || placeholder}
        </Text>
        <Text style={{ color: colors.subtle, fontSize: 12 }}>📅</Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
});
