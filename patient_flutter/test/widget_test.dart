import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wellness_hub/main.dart';

void main() {
  testWidgets('Wellness Hub launches successfully', (tester) async {
    await tester.pumpWidget(const WellnessHub());

    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
