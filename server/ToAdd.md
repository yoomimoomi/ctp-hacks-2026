# To save to DB in classifier
    db_record = Classification(
        item_name=result.item_name,
        material_type=result.material_type,
        nyc_stream_category=result.nyc_stream_category,
        bin_color=result.bin_color,
        is_recyclable=result.is_recyclable,
        preparation_instructions=result.preparation_instructions,
        nyc_rule_notes=result.nyc_rule_notes,
    )
    db.add(db_record)
    db.commit()